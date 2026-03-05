import { Router } from 'express';
import type { Logger } from 'pino';
import { serializeUser } from '../../account/api/user-serializer.js';
import { getClerkAuth } from '../../shared/middleware/auth.js';
import type { KycAppService } from '../application/kyc-app-service.js';
import { kycSubmitSchema } from './schemas/kyc-submit.schema.js';

export function createKycRouter(kycAppService: KycAppService, logger: Logger): Router {
  const router = Router();

  /**
   * GET /api/v1/kyc/status
   * Returns the authenticated user's current KYC verification status.
   */
  router.get('/status', async (req, res, next) => {
    try {
      const auth = getClerkAuth(req);
      if (!auth) {
        res.status(401).json({
          error: {
            code: 'UNAUTHENTICATED',
            message: 'Authentication required. Sign in to continue.',
            correlation_id: req.correlationId ?? null,
          },
        });
        return;
      }

      const { kycStatus, updatedAt } = await kycAppService.getKycStatus(auth.userId);
      res.status(200).json({
        data: {
          kycStatus,
          updatedAt: updatedAt.toISOString(),
        },
      });
    } catch (err) {
      next(err);
    }
  });

  /**
   * POST /api/v1/kyc/submit
   * Initiates KYC verification for the authenticated user.
   * With stub adapter: not_started|rejected → pending → verified synchronously.
   */
  router.post('/submit', async (req, res, next) => {
    try {
      const auth = getClerkAuth(req);
      if (!auth) {
        res.status(401).json({
          error: {
            code: 'UNAUTHENTICATED',
            message: 'Authentication required. Sign in to continue.',
            correlation_id: req.correlationId ?? null,
          },
        });
        return;
      }

      // Normalize missing/null body to empty object — spec says "Empty object or no body"
      const parseResult = kycSubmitSchema.safeParse(req.body ?? {});
      if (!parseResult.success) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Check your input and try again.',
            correlation_id: req.correlationId ?? null,
            issues: parseResult.error.issues.map((i) => ({
              path: i.path.join('.'),
              message: i.message,
            })),
          },
        });
        return;
      }

      const user = await kycAppService.submitKyc(auth.userId);
      res.status(200).json({ data: serializeUser(user) });
    } catch (err) {
      logger.debug({ err }, 'KYC submit error — passing to error handler');
      next(err);
    }
  });

  return router;
}
