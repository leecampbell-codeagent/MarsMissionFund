import { Router } from 'express';
import type { Logger } from 'pino';
import { z } from 'zod';
import { getClerkAuth } from '../../shared/middleware/auth.js';
import type { CampaignAppService } from '../application/campaign-app-service.js';
import type { UpdateCampaignInput } from '../domain/models/campaign.js';
import { approveCampaignSchema } from './schemas/approve-campaign.schema.js';
import { createCampaignSchema } from './schemas/create-campaign.schema.js';
import { reassignCampaignSchema } from './schemas/reassign-campaign.schema.js';
import { rejectCampaignSchema } from './schemas/reject-campaign.schema.js';
import { updateCampaignSchema } from './schemas/update-campaign.schema.js';
import { serializeCampaign, serializeCampaignSummary } from './campaign-serializer.js';

// Empty body schema — rejects any fields
const emptyBodySchema = z.object({}).strict();

function requireAuthOrUnauthorized(
  req: Parameters<Parameters<Router['get']>[1]>[0],
  res: Parameters<Parameters<Router['get']>[1]>[1],
): string | null {
  const auth = getClerkAuth(req);
  if (!auth) {
    res.status(401).json({
      error: {
        code: 'UNAUTHENTICATED',
        message: 'Authentication required. Sign in to continue.',
        correlation_id: req.correlationId ?? null,
      },
    });
    return null;
  }
  return auth.userId;
}

export function createCampaignRouter(
  campaignAppService: CampaignAppService,
  _logger: Logger,
): Router {
  const router = Router();

  /**
   * GET /api/v1/campaigns/review-queue
   * Returns submitted campaigns in FIFO order for review.
   * MUST be registered BEFORE /:id (G-023).
   */
  router.get('/review-queue', async (req, res, next) => {
    try {
      const clerkUserId = requireAuthOrUnauthorized(req, res);
      if (!clerkUserId) return;

      const campaigns = await campaignAppService.getReviewQueue(clerkUserId);
      res.status(200).json({ data: campaigns.map(serializeCampaignSummary) });
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /api/v1/campaigns/:id
   * Returns full campaign details with access control by role/status.
   */
  router.get('/:id', async (req, res, next) => {
    try {
      const clerkUserId = requireAuthOrUnauthorized(req, res);
      if (!clerkUserId) return;

      const campaign = await campaignAppService.getCampaign(clerkUserId, req.params.id);
      res.status(200).json({ data: serializeCampaign(campaign) });
    } catch (err) {
      next(err);
    }
  });

  /**
   * POST /api/v1/campaigns
   * Creates a new campaign draft.
   */
  router.post('/', async (req, res, next) => {
    try {
      const clerkUserId = requireAuthOrUnauthorized(req, res);
      if (!clerkUserId) return;

      const parseResult = createCampaignSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request body is invalid.',
            correlation_id: req.correlationId ?? null,
            issues: parseResult.error.issues.map((i) => ({
              path: i.path.join('.'),
              message: i.message,
            })),
          },
        });
        return;
      }

      const campaign = await campaignAppService.createDraft(clerkUserId, parseResult.data);
      res.status(201).json({ data: serializeCampaign(campaign) });
    } catch (err) {
      next(err);
    }
  });

  /**
   * PATCH /api/v1/campaigns/:id
   * Auto-saves campaign draft fields. Partial update — any subset of fields.
   */
  router.patch('/:id', async (req, res, next) => {
    try {
      const clerkUserId = requireAuthOrUnauthorized(req, res);
      if (!clerkUserId) return;

      const parseResult = updateCampaignSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request body is invalid.',
            correlation_id: req.correlationId ?? null,
            issues: parseResult.error.issues.map((i) => ({
              path: i.path.join('.'),
              message: i.message,
            })),
          },
        });
        return;
      }

      const campaign = await campaignAppService.updateDraft(
        clerkUserId,
        req.params.id,
        parseResult.data as UpdateCampaignInput,
      );
      res.status(200).json({ data: serializeCampaign(campaign) });
    } catch (err) {
      next(err);
    }
  });

  /**
   * POST /api/v1/campaigns/:id/submit
   * Submits draft campaign for review. Full submission validation.
   */
  router.post('/:id/submit', async (req, res, next) => {
    try {
      const clerkUserId = requireAuthOrUnauthorized(req, res);
      if (!clerkUserId) return;

      // No body accepted
      const parseResult = emptyBodySchema.safeParse(req.body ?? {});
      if (!parseResult.success) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'No request body fields are accepted for this endpoint.',
            correlation_id: req.correlationId ?? null,
          },
        });
        return;
      }

      const campaign = await campaignAppService.submitCampaign(clerkUserId, req.params.id);
      res.status(200).json({ data: serializeCampaign(campaign) });
    } catch (err) {
      next(err);
    }
  });

  /**
   * POST /api/v1/campaigns/:id/claim
   * Reviewer claims a submitted campaign for review.
   */
  router.post('/:id/claim', async (req, res, next) => {
    try {
      const clerkUserId = requireAuthOrUnauthorized(req, res);
      if (!clerkUserId) return;

      const campaign = await campaignAppService.claimCampaign(clerkUserId, req.params.id);
      res.status(200).json({ data: serializeCampaign(campaign) });
    } catch (err) {
      next(err);
    }
  });

  /**
   * POST /api/v1/campaigns/:id/approve
   * Reviewer approves a campaign under review.
   */
  router.post('/:id/approve', async (req, res, next) => {
    try {
      const clerkUserId = requireAuthOrUnauthorized(req, res);
      if (!clerkUserId) return;

      const parseResult = approveCampaignSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request body is invalid.',
            correlation_id: req.correlationId ?? null,
            issues: parseResult.error.issues.map((i) => ({
              path: i.path.join('.'),
              message: i.message,
            })),
          },
        });
        return;
      }

      const campaign = await campaignAppService.approveCampaign(
        clerkUserId,
        req.params.id,
        parseResult.data.reviewNotes,
      );
      res.status(200).json({ data: serializeCampaign(campaign) });
    } catch (err) {
      next(err);
    }
  });

  /**
   * POST /api/v1/campaigns/:id/reject
   * Reviewer rejects a campaign with rationale and guidance.
   */
  router.post('/:id/reject', async (req, res, next) => {
    try {
      const clerkUserId = requireAuthOrUnauthorized(req, res);
      if (!clerkUserId) return;

      const parseResult = rejectCampaignSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request body is invalid.',
            correlation_id: req.correlationId ?? null,
            issues: parseResult.error.issues.map((i) => ({
              path: i.path.join('.'),
              message: i.message,
            })),
          },
        });
        return;
      }

      const campaign = await campaignAppService.rejectCampaign(
        clerkUserId,
        req.params.id,
        parseResult.data.rejectionReason,
        parseResult.data.resubmissionGuidance,
      );
      res.status(200).json({ data: serializeCampaign(campaign) });
    } catch (err) {
      next(err);
    }
  });

  /**
   * POST /api/v1/campaigns/:id/launch
   * Creator launches an approved campaign to Live status.
   */
  router.post('/:id/launch', async (req, res, next) => {
    try {
      const clerkUserId = requireAuthOrUnauthorized(req, res);
      if (!clerkUserId) return;

      const campaign = await campaignAppService.launchCampaign(clerkUserId, req.params.id);
      res.status(200).json({ data: serializeCampaign(campaign) });
    } catch (err) {
      next(err);
    }
  });

  /**
   * POST /api/v1/campaigns/:id/archive
   * Archives a campaign (creator: draft/rejected only; admin: any status).
   */
  router.post('/:id/archive', async (req, res, next) => {
    try {
      const clerkUserId = requireAuthOrUnauthorized(req, res);
      if (!clerkUserId) return;

      const campaign = await campaignAppService.archiveCampaign(clerkUserId, req.params.id);
      res.status(200).json({ data: serializeCampaign(campaign) });
    } catch (err) {
      next(err);
    }
  });

  /**
   * POST /api/v1/campaigns/:id/reassign
   * Admin reassigns a campaign to a different reviewer.
   */
  router.post('/:id/reassign', async (req, res, next) => {
    try {
      const clerkUserId = requireAuthOrUnauthorized(req, res);
      if (!clerkUserId) return;

      const parseResult = reassignCampaignSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request body is invalid.',
            correlation_id: req.correlationId ?? null,
            issues: parseResult.error.issues.map((i) => ({
              path: i.path.join('.'),
              message: i.message,
            })),
          },
        });
        return;
      }

      const campaign = await campaignAppService.reassignReviewer(
        clerkUserId,
        req.params.id,
        parseResult.data.reviewerUserId,
      );
      res.status(200).json({ data: serializeCampaign(campaign) });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
