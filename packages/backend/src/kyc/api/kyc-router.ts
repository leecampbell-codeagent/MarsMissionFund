import { Router } from 'express';
import { z } from 'zod';
import type { AccountRole } from '../../account/domain/account.js';
import {
  AccountNotFoundError,
} from '../../shared/domain/errors.js';
import {
  InsufficientRoleError,
  InvalidKycTransitionError,
  KycLockedError,
  KycAlreadyVerifiedError,
  KycVerificationNotFoundError,
} from '../domain/errors.js';
import type { KycAppService } from '../application/kyc-app-service.js';

const submitKycSchema = z
  .object({
    document_type: z.enum(['passport', 'national_id', 'drivers_licence']),
    front_document_ref: z.string().min(1).max(512).nullish(),
    back_document_ref: z.string().min(1).max(512).nullish(),
  })
  .strict();

const ADMIN_ROLES: readonly AccountRole[] = ['administrator', 'super_administrator'];

function zodErrorMessage(error: z.ZodError): string {
  const issues =
    (error as unknown as { issues?: { message: string }[] }).issues ??
    (error as unknown as { errors?: { message: string }[] }).errors ??
    [];
  return issues[0]?.message ?? 'Validation failed.';
}

export function createKycRouter(kycAppService: KycAppService): Router {
  const router = Router();

  /**
   * POST /api/v1/kyc/submit
   * Initiates a KYC verification session for the authenticated user.
   */
  router.post('/api/v1/kyc/submit', async (req, res, next) => {
    try {
      const accountId = req.authContext?.userId;
      if (!accountId) {
        res.status(401).json({
          error: { code: 'UNAUTHENTICATED', message: 'Authentication required.', correlation_id: req.id },
        });
        return;
      }

      const parseResult = submitKycSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: zodErrorMessage(parseResult.error),
            correlation_id: req.id,
          },
        });
        return;
      }

      const { document_type, front_document_ref, back_document_ref } = parseResult.data;

      try {
        const result = await kycAppService.submitVerification({
          userId: accountId,
          documentType: document_type,
          frontDocumentRef: front_document_ref,
          backDocumentRef: back_document_ref,
        });

        res.status(200).json({ data: result });
      } catch (err) {
        if (err instanceof KycLockedError) {
          res.status(403).json({
            error: { code: err.code, message: err.message, correlation_id: req.id },
          });
          return;
        }
        if (err instanceof KycAlreadyVerifiedError) {
          res.status(409).json({
            error: { code: err.code, message: err.message, correlation_id: req.id },
          });
          return;
        }
        if (err instanceof InvalidKycTransitionError) {
          res.status(409).json({
            error: { code: err.code, message: err.message, correlation_id: req.id },
          });
          return;
        }
        if (err instanceof AccountNotFoundError) {
          res.status(404).json({
            error: { code: err.code, message: err.message, correlation_id: req.id },
          });
          return;
        }
        throw err;
      }
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/v1/kyc/status
   * Returns the current KYC verification status for the authenticated user.
   */
  router.get('/api/v1/kyc/status', async (req, res, next) => {
    try {
      const accountId = req.authContext?.userId;
      if (!accountId) {
        res.status(401).json({
          error: { code: 'UNAUTHENTICATED', message: 'Authentication required.', correlation_id: req.id },
        });
        return;
      }

      const result = await kycAppService.getVerificationStatus(accountId);
      res.status(200).json({ data: result });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/v1/kyc/admin/unlock/:accountId
   * Admin-only: unlocks a locked KYC verification.
   */
  router.post('/api/v1/kyc/admin/unlock/:accountId', async (req, res, next) => {
    try {
      const adminId = req.authContext?.userId;
      if (!adminId) {
        res.status(401).json({
          error: { code: 'UNAUTHENTICATED', message: 'Authentication required.', correlation_id: req.id },
        });
        return;
      }

      // Check admin role
      const roles = req.authContext?.roles ?? [];
      const isAdmin = roles.some((r) => ADMIN_ROLES.includes(r as AccountRole));
      if (!isAdmin) {
        res.status(403).json({
          error: {
            code: 'INSUFFICIENT_ROLE',
            message: 'Only administrators or super administrators can unlock KYC verifications.',
            correlation_id: req.id,
          },
        });
        return;
      }

      const { accountId } = req.params;
      if (!accountId) {
        res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'accountId is required.', correlation_id: req.id },
        });
        return;
      }

      try {
        const result = await kycAppService.adminUnlock(adminId, accountId);
        res.status(200).json({ data: result });
      } catch (err) {
        if (err instanceof KycVerificationNotFoundError) {
          res.status(404).json({
            error: { code: err.code, message: err.message, correlation_id: req.id },
          });
          return;
        }
        if (err instanceof InvalidKycTransitionError) {
          res.status(409).json({
            error: { code: err.code, message: err.message, correlation_id: req.id },
          });
          return;
        }
        if (err instanceof InsufficientRoleError) {
          res.status(403).json({
            error: { code: err.code, message: err.message, correlation_id: req.id },
          });
          return;
        }
        if (err instanceof AccountNotFoundError) {
          res.status(404).json({
            error: { code: err.code, message: err.message, correlation_id: req.id },
          });
          return;
        }
        throw err;
      }
    } catch (error) {
      next(error);
    }
  });

  return router;
}
