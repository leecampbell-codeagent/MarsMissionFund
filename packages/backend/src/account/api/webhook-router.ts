import { Router } from 'express';
import express from 'express';
import type { AccountAppService } from '../application/account-app-service.js';
import type { WebhookVerificationPort } from '../ports/webhook-verification-port.js';
import type { Logger } from 'pino';

export function createWebhookRouter(
  accountAppService: AccountAppService,
  webhookVerifier: WebhookVerificationPort,
  logger: Logger,
): Router {
  const router = Router();

  // Webhook needs raw body for signature verification.
  // We use express.raw() to parse the body as a Buffer.
  router.post(
    '/api/webhooks/clerk',
    express.raw({ type: 'application/json' }),
    async (req, res) => {
      try {
        const payload =
          typeof req.body === 'string'
            ? req.body
            : Buffer.isBuffer(req.body)
              ? req.body.toString('utf8')
              : JSON.stringify(req.body);

        const headers: Record<string, string> = {
          'svix-id': (req.headers['svix-id'] as string | undefined) ?? '',
          'svix-timestamp': (req.headers['svix-timestamp'] as string | undefined) ?? '',
          'svix-signature': (req.headers['svix-signature'] as string | undefined) ?? '',
        };

        const event = webhookVerifier.verifyWebhookSignature(payload, headers);

        await accountAppService.handleWebhookEvent(event);

        res.status(200).json({ received: true });
      } catch (error: unknown) {
        if (error instanceof Error && error.name === 'AuthenticationError') {
          logger.error(
            { error: error.message, correlationId: req.id },
            'Webhook signature verification failed',
          );
          res.status(401).json({
            error: {
              code: 'WEBHOOK_SIGNATURE_INVALID',
              message: 'Webhook signature verification failed.',
              correlation_id: req.id,
            },
          });
          return;
        }

        logger.error({ error }, 'Unexpected error processing webhook');
        res.status(500).json({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred.',
            correlation_id: req.id,
          },
        });
      }
    },
  );

  return router;
}
