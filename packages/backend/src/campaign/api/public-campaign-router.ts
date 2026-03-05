import { Router } from 'express';
import type { Logger } from 'pino';
import type { CampaignAppService } from '../application/campaign-app-service.js';
import type { CampaignCategory } from '../domain/value-objects/campaign-category.js';
import {
  serializeCategoryStats,
  serializePublicCampaignDetail,
  serializePublicCampaignListItem,
} from './public-campaign-serializer.js';
import {
  categoryStatsQuerySchema,
  publicCampaignSearchSchema,
} from './schemas/public-campaign-search.schema.js';

/**
 * Creates the public campaign router.
 * IMPORTANT: This router is mounted WITHOUT requireAuth middleware (G-036).
 * Mount point: /api/v1/public/campaigns
 *
 * Route registration order (G-023):
 * 1. GET /stats — literal path before /:id
 * 2. GET / — search/browse list
 * 3. GET /:id — parameterised detail
 */
export function createPublicCampaignRouter(
  campaignAppService: CampaignAppService,
  logger: Logger,
): Router {
  const router = Router();

  /**
   * GET /api/v1/public/campaigns/stats
   * Returns aggregate statistics for a campaign category.
   * Auth: None required.
   * MUST be registered BEFORE /:id (G-023).
   */
  router.get('/stats', async (req, res, next) => {
    try {
      const parseResult = categoryStatsQuerySchema.safeParse(req.query);
      if (!parseResult.success) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Query parameter validation failed.',
            correlation_id: req.correlationId ?? null,
            issues: parseResult.error.issues.map((i) => ({
              path: i.path.join('.'),
              message: i.message,
            })),
          },
        });
        return;
      }

      const stats = await campaignAppService.getCategoryStats(
        parseResult.data.category as CampaignCategory,
      );
      res.status(200).json({ data: serializeCategoryStats(stats) });
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /api/v1/public/campaigns
   * Search and browse public campaigns with FTS, filters, and pagination.
   * Auth: None required.
   */
  router.get('/', async (req, res, next) => {
    try {
      const parseResult = publicCampaignSearchSchema.safeParse(req.query);
      if (!parseResult.success) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Query parameter validation failed.',
            correlation_id: req.correlationId ?? null,
            issues: parseResult.error.issues.map((i) => ({
              path: i.path.join('.'),
              message: i.message,
            })),
          },
        });
        return;
      }

      const { q, category, status, sort, limit, offset } = parseResult.data;

      const result = await campaignAppService.searchPublicCampaigns({
        q,
        categories: category,
        status,
        sort,
        limit,
        offset,
      });

      const now = new Date();
      res.status(200).json({
        data: result.items.map((item) => serializePublicCampaignListItem(item, now)),
        pagination: {
          total: result.total,
          limit,
          offset,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /api/v1/public/campaigns/:id
   * Full public detail for a single live or funded campaign.
   * Auth: None required.
   * Returns 404 for non-existent or non-public campaigns — do NOT reveal existence.
   */
  router.get('/:id', async (req, res, next) => {
    try {
      const campaign = await campaignAppService.getPublicCampaign(req.params.id);
      const now = new Date();
      res.status(200).json({ data: serializePublicCampaignDetail(campaign, now) });
    } catch (err) {
      next(err);
    }
  });

  logger.debug('Public campaign router registered');
  return router;
}
