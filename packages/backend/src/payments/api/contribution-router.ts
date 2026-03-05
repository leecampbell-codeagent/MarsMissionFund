import { Router } from 'express';
import type { Logger } from 'pino';
import { getClerkAuth } from '../../shared/middleware/auth.js';
import type { ContributionAppService } from '../application/contribution-app-service.js';
import { serializeContribution } from './contribution-serializer.js';
import { createContributionSchema } from './schemas/create-contribution.schema.js';

export function createContributionRouter(
  contributionAppService: ContributionAppService,
  _logger: Logger,
): Router {
  const router = Router();

  /**
   * POST /api/v1/contributions
   * Creates a new contribution and processes payment via the stub gateway.
   * Always returns 201 — including payment failures (status: "failed" in body).
   */
  router.post('/', async (req, res, next) => {
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

      const parseResult = createContributionSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: parseResult.error.errors[0]?.message ?? 'Invalid request body.',
            correlation_id: req.correlationId ?? null,
          },
        });
        return;
      }

      const contribution = await contributionAppService.createContribution(
        auth.userId,
        parseResult.data,
      );

      res.status(201).json({ data: serializeContribution(contribution) });
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /api/v1/contributions/:id
   * Returns the contribution if it belongs to the authenticated user.
   * Returns 404 if not found or belongs to another user (security: do not reveal existence).
   */
  router.get('/:id', async (req, res, next) => {
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

      const contribution = await contributionAppService.getContributionForDonor(
        auth.userId,
        req.params.id,
      );

      res.status(200).json({ data: serializeContribution(contribution) });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
