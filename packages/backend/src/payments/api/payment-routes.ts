import express, { Router } from 'express';
import type { Logger } from 'pino';
import { z } from 'zod';
import { DomainError } from '../../shared/domain/errors.js';
import type { PaymentAppService } from '../application/payment-app-service.js';
import {
  InvalidWebhookSignatureError,
  PaymentGatewayError,
} from '../domain/payment-errors.js';
import { capturePaymentSchema } from './payment-schemas.js';

function serializeContribution(contribution: {
  id: string;
  donorId: string;
  campaignId: string;
  amountCents: number;
  status: string;
  gatewayReference: string | null;
  createdAt: Date;
  updatedAt: Date;
}): Record<string, unknown> {
  return {
    id: contribution.id,
    donor_id: contribution.donorId,
    campaign_id: contribution.campaignId,
    amount_cents: String(contribution.amountCents),
    status: contribution.status,
    gateway_reference: contribution.gatewayReference,
    created_at: contribution.createdAt.toISOString(),
    updated_at: contribution.updatedAt.toISOString(),
  };
}

/**
 * Creates the webhook-only router (no auth, raw body).
 * Must be mounted BEFORE express.json() middleware.
 */
export function createPaymentWebhookRouter(
  paymentAppService: PaymentAppService,
  logger: Logger,
): Router {
  const router = Router();

  /**
   * POST /api/v1/payments/webhook
   * Receives payment gateway webhook events. No auth — verified via signature.
   * MUST use express.raw() body parser (raw body required for Stripe signature verification).
   */
  router.post(
    '/api/v1/payments/webhook',
    // Capture the raw body for Stripe signature verification.
    // Stripe sends application/json, so we use express.raw with that type.
    // For tests, we also accept text/plain and octet-stream.
    express.raw({ type: ['application/json', 'text/plain', 'application/octet-stream'] }),
    async (req, res) => {
      try {
        let rawBody: Buffer;
        if (Buffer.isBuffer(req.body)) {
          rawBody = req.body;
        } else if (typeof req.body === 'string') {
          rawBody = Buffer.from(req.body, 'utf8');
        } else {
          rawBody = Buffer.from(JSON.stringify(req.body ?? {}), 'utf8');
        }
        const signature = (req.headers['stripe-signature'] as string | undefined) ?? '';

        await paymentAppService.processWebhookEvent(rawBody, signature);

        res.status(200).json({ received: true });
      } catch (error: unknown) {
        if (error instanceof InvalidWebhookSignatureError) {
          res.status(400).json({
            error: {
              code: error.code,
              message: error.message,
              correlation_id: req.id,
            },
          });
          return;
        }

        logger.error({ error, correlationId: req.id }, 'Unexpected error processing webhook');
        res.status(500).json({
          error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.', correlation_id: req.id },
        });
      }
    },
  );

  return router;
}

/**
 * Creates the authenticated payment routes router.
 * Must be mounted AFTER auth middleware (requireAuth + enrichContext).
 */
export function createPaymentRouter(
  paymentAppService: PaymentAppService,
  logger: Logger,
): Router {
  const router = Router();

  /**
   * POST /api/v1/payments/capture
   * Captures a payment contribution. Requires authentication.
   */
  router.post('/api/v1/payments/capture', async (req, res) => {
    try {
      const ctx = req.authContext;
      if (!ctx) {
        res.status(401).json({
          error: { code: 'UNAUTHENTICATED', message: 'Authentication required.', correlation_id: req.id },
        });
        return;
      }

      const parseResult = capturePaymentSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body.',
            details: parseResult.error.issues,
            correlation_id: req.id,
          },
        });
        return;
      }

      const { campaign_id, amount_cents, payment_method_token } = parseResult.data;

      const contribution = await paymentAppService.captureContribution({
        donorId: ctx.userId,
        campaignId: campaign_id,
        amountCents: amount_cents,
        paymentMethodToken: payment_method_token,
      });

      res.status(201).json({ data: serializeContribution(contribution) });
    } catch (error: unknown) {
      if (error instanceof PaymentGatewayError) {
        res.status(402).json({
          error: {
            code: error.code,
            message: error.message,
            correlation_id: req.id,
          },
        });
        return;
      }

      if (error instanceof DomainError) {
        res.status(400).json({
          error: { code: error.code, message: error.message, correlation_id: req.id },
        });
        return;
      }

      logger.error({ error, correlationId: req.id }, 'Unexpected error capturing payment');
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.', correlation_id: req.id },
      });
    }
  });

  /**
   * GET /api/v1/campaigns/:campaignId/escrow-balance
   * Returns current escrow balance. Requires admin role.
   */
  router.get('/api/v1/campaigns/:campaignId/escrow-balance', async (req, res) => {
    try {
      const ctx = req.authContext;
      if (!ctx) {
        res.status(401).json({
          error: { code: 'UNAUTHENTICATED', message: 'Authentication required.', correlation_id: req.id },
        });
        return;
      }

      const isAdmin =
        ctx.roles.includes('administrator') || ctx.roles.includes('super_administrator');

      if (!isAdmin) {
        res.status(403).json({
          error: { code: 'UNAUTHORIZED', message: 'Administrator role required.', correlation_id: req.id },
        });
        return;
      }

      const campaignIdParam = req.params['campaignId'];
      const campaignIdParse = z.string().uuid().safeParse(campaignIdParam);
      if (!campaignIdParse.success) {
        res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'campaignId must be a valid UUID.', correlation_id: req.id },
        });
        return;
      }

      const { balanceCents, entryCount } = await paymentAppService.getEscrowBalance(
        campaignIdParse.data,
      );

      res.status(200).json({
        data: {
          campaign_id: campaignIdParse.data,
          balance_cents: String(balanceCents),
          entry_count: entryCount,
        },
      });
    } catch (error: unknown) {
      logger.error({ error, correlationId: req.id }, 'Unexpected error fetching escrow balance');
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.', correlation_id: req.id },
      });
    }
  });

  return router;
}
