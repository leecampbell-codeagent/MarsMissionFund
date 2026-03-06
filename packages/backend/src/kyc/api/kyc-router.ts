import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import type { KycService } from '../application/kyc-service.js';
import { AlreadyVerifiedError } from '../domain/errors.js';

const submitKycSchema = z
  .object({
    documentType: z.enum(['passport', 'national_id', 'drivers_licence']),
  })
  .strict();

export function createKycRouter(kycService: KycService): Router {
  const router = Router();

  // GET /api/v1/kyc/status
  router.get('/status', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.auth) {
        res
          .status(401)
          .json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required.' } });
        return;
      }

      const { status, verifiedAt } = await kycService.getStatus(req.auth.userId);

      res.status(200).json({
        data: {
          status,
          verifiedAt: verifiedAt ? verifiedAt.toISOString() : null,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/v1/kyc/submit
  router.post('/submit', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.auth) {
        res
          .status(401)
          .json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required.' } });
        return;
      }

      const parsed = submitKycSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message ?? 'Validation failed.',
          },
        });
        return;
      }

      const verification = await kycService.submitVerification(
        req.auth.userId,
        parsed.data.documentType,
      );

      res.status(201).json({
        data: {
          status: verification.status,
          verifiedAt: verification.verifiedAt ? verification.verifiedAt.toISOString() : null,
        },
      });
    } catch (err) {
      if (err instanceof AlreadyVerifiedError) {
        res.status(409).json({
          error: {
            code: 'ALREADY_VERIFIED',
            message: err.message,
          },
        });
        return;
      }
      next(err);
    }
  });

  return router;
}
