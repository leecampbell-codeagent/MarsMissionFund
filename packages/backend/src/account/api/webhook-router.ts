import { Router } from 'express';
import type { Logger } from 'pino';
import { Webhook } from 'svix';
import type { AccountAppService, ClerkWebhookEvent } from '../application/account-app-service.js';

export function createWebhookRouter(accountAppService: AccountAppService, logger: Logger): Router {
  const router = Router();

  /**
   * POST /api/v1/webhooks/clerk
   * Receives Clerk lifecycle webhooks. Verified via Svix HMAC signature.
   * IMPORTANT: Uses express.raw() middleware — must NOT parse body as JSON first.
   */
  router.post(
    '/clerk',
    (_req, _res, next) => {
      // express.raw() middleware applied per-route to preserve raw body for Svix verification
      // This is handled at app level — body should already be raw Buffer
      next();
    },
    async (req, res) => {
      const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
      const correlationId = req.correlationId ?? null;

      if (!webhookSecret) {
        logger.error('CLERK_WEBHOOK_SECRET is not configured');
        res.status(500).json({
          error: {
            code: 'INTERNAL_ERROR',
            message: "Something went wrong on our end. We're looking into it.",
            correlation_id: correlationId,
          },
        });
        return;
      }

      // Extract Svix headers for signature verification
      const svixId = req.headers['svix-id'];
      const svixTimestamp = req.headers['svix-timestamp'];
      const svixSignature = req.headers['svix-signature'];

      if (!svixId || !svixTimestamp || !svixSignature) {
        logger.warn(
          { securityEvent: true, correlationId },
          'Webhook received without Svix headers — rejecting',
        );
        res.status(400).json({
          error: {
            code: 'INVALID_SIGNATURE',
            message: 'Invalid webhook signature.',
            correlation_id: correlationId,
          },
        });
        return;
      }

      // Verify the signature using Svix
      let payload: ClerkWebhookEvent;
      try {
        const wh = new Webhook(webhookSecret);
        // req.body is a Buffer when express.raw() is used
        const rawBody =
          req.body instanceof Buffer ? req.body : Buffer.from(JSON.stringify(req.body));

        payload = wh.verify(rawBody, {
          'svix-id': svixId as string,
          'svix-timestamp': svixTimestamp as string,
          'svix-signature': svixSignature as string,
        }) as ClerkWebhookEvent;
      } catch (err) {
        logger.warn(
          { securityEvent: true, correlationId, err },
          'Webhook signature verification failed',
        );
        res.status(400).json({
          error: {
            code: 'INVALID_SIGNATURE',
            message: 'Invalid webhook signature.',
            correlation_id: correlationId,
          },
        });
        return;
      }

      // Handle known event types
      const handledTypes = ['user.created', 'user.updated', 'session.created'];
      if (!handledTypes.includes(payload.type)) {
        logger.info({ eventType: payload.type }, 'Unknown webhook event type — acknowledging');
        res.status(200).json({ received: true, processed: false });
        return;
      }

      try {
        await accountAppService.handleClerkWebhook(payload);
        res.status(200).json({ received: true });
      } catch (err) {
        logger.error(
          {
            err,
            clerkUserId: payload.data.id,
            eventType: payload.type,
            correlationId,
          },
          'Error processing Clerk webhook',
        );
        res.status(500).json({
          error: {
            code: 'INTERNAL_ERROR',
            message: "Something went wrong on our end. We're looking into it.",
            correlation_id: correlationId,
          },
        });
      }
    },
  );

  return router;
}
