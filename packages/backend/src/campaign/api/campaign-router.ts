import { Router } from 'express';
import { z } from 'zod';
import type { AccountRole } from '../../account/domain/account.js';
import {
  CampaignAlreadySubmittedError,
  CampaignNotFoundError,
  CampaignNotReviewableError,
  InvalidCampaignError,
  InsufficientRoleError,
  KycRequiredError,
  ReviewerCommentRequiredError,
} from '../domain/errors.js';
import type { CampaignAppService } from '../application/campaign-app-service.js';

const CAMPAIGN_CATEGORIES = [
  'propulsion',
  'entry_descent_landing',
  'power_energy',
  'habitats_construction',
  'life_support_crew_health',
  'food_water_production',
  'isru',
  'radiation_protection',
  'robotics_automation',
  'communications_navigation',
] as const;

const milestoneSchema = z.object({
  title: z.string().trim().min(1).max(200).nullish(),
  description: z.string().trim().max(2000).nullish(),
  target_date: z.string().datetime({ offset: true }).nullish(),
  funding_percentage: z.number().int().min(0).max(100).nullish(),
  verification_criteria: z.string().trim().max(2000).nullish(),
});

const createCampaignSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    category: z.enum(CAMPAIGN_CATEGORIES),
    min_funding_target_cents: z
      .string()
      .regex(/^\d+$/, 'Must be a string integer')
      .transform((v) => Number(v)),
    max_funding_cap_cents: z
      .string()
      .regex(/^\d+$/, 'Must be a string integer')
      .transform((v) => Number(v)),
    summary: z.string().trim().max(280).nullish(),
    description: z.string().trim().max(10000).nullish(),
    mars_alignment_statement: z.string().trim().max(2000).nullish(),
    deadline: z.string().datetime({ offset: true }).nullish(),
    budget_breakdown: z.string().trim().max(5000).nullish(),
    team_info: z.string().trim().max(10000).nullish(),
    risk_disclosures: z.string().trim().max(10000).nullish(),
    hero_image_url: z.string().url().startsWith('https://').max(2048).nullish(),
    milestones: z.array(milestoneSchema).max(20).optional(),
  })
  .strict();

const updateCampaignSchema = z
  .object({
    title: z.string().trim().min(1).max(200).nullish(),
    category: z.enum(CAMPAIGN_CATEGORIES).nullish(),
    min_funding_target_cents: z
      .string()
      .regex(/^\d+$/, 'Must be a string integer')
      .transform((v) => Number(v))
      .nullish(),
    max_funding_cap_cents: z
      .string()
      .regex(/^\d+$/, 'Must be a string integer')
      .transform((v) => Number(v))
      .nullish(),
    summary: z.string().trim().max(280).nullish(),
    description: z.string().trim().max(10000).nullish(),
    mars_alignment_statement: z.string().trim().max(2000).nullish(),
    deadline: z.string().datetime({ offset: true }).nullish(),
    budget_breakdown: z.string().trim().max(5000).nullish(),
    team_info: z.string().trim().max(10000).nullish(),
    risk_disclosures: z.string().trim().max(10000).nullish(),
    hero_image_url: z.string().url().startsWith('https://').max(2048).nullish(),
    milestones: z.array(milestoneSchema).max(20).nullish(),
  })
  .strict();

const reviewCommentSchema = z
  .object({
    comment: z.string().trim().min(1, 'Comment is required.').max(5000),
  })
  .strict();

function zodErrorMessage(error: z.ZodError): string {
  const issues =
    (error as unknown as { issues?: { message: string }[] }).issues ??
    (error as unknown as { errors?: { message: string }[] }).errors ??
    [];
  return issues[0]?.message ?? 'Validation failed.';
}

function zodErrorDetails(error: z.ZodError): unknown[] {
  const issues =
    (error as unknown as { issues?: unknown[] }).issues ??
    (error as unknown as { errors?: unknown[] }).errors ??
    [];
  return issues;
}

function formatCampaignResult(
  result: import('../application/campaign-app-service.js').CampaignResult,
) {
  return {
    id: result.id,
    creator_id: result.creatorId,
    title: result.title,
    summary: result.summary,
    description: result.description,
    mars_alignment_statement: result.marsAlignmentStatement,
    category: result.category,
    status: result.status,
    min_funding_target_cents: String(result.minFundingTargetCents),
    max_funding_cap_cents: String(result.maxFundingCapCents),
    deadline: result.deadline?.toISOString() ?? null,
    budget_breakdown: result.budgetBreakdown,
    team_info: result.teamInfo,
    risk_disclosures: result.riskDisclosures,
    hero_image_url: result.heroImageUrl,
    reviewer_id: result.reviewerId,
    reviewer_comment: result.reviewerComment,
    reviewed_at: result.reviewedAt?.toISOString() ?? null,
    milestones: result.milestones.map((m) => ({
      id: m.id,
      campaign_id: m.campaignId,
      title: m.title,
      description: m.description,
      target_date: m.targetDate?.toISOString() ?? null,
      funding_percentage: m.fundingPercentage,
      verification_criteria: m.verificationCriteria,
      status: m.status,
      created_at: m.createdAt.toISOString(),
      updated_at: m.updatedAt.toISOString(),
    })),
    created_at: result.createdAt.toISOString(),
    updated_at: result.updatedAt.toISOString(),
  };
}

const CREATOR_ROLES: readonly AccountRole[] = ['creator'];
const REVIEWER_ROLES: readonly AccountRole[] = ['reviewer', 'administrator'];

export function createCampaignRouter(campaignAppService: CampaignAppService): Router {
  const router = Router();

  /**
   * POST /api/v1/campaigns — Create a new campaign draft
   * Requires: authenticated user with creator role
   */
  router.post('/api/v1/campaigns', async (req, res, next) => {
    try {
      const userId = req.authContext?.userId;
      if (!userId) {
        res.status(401).json({
          error: { code: 'UNAUTHENTICATED', message: 'Authentication required.', correlation_id: req.id },
        });
        return;
      }

      // Check creator role
      const roles = req.authContext?.roles ?? [];
      const isCreator = roles.some((r) => CREATOR_ROLES.includes(r as AccountRole));
      if (!isCreator) {
        res.status(403).json({
          error: {
            code: 'INSUFFICIENT_ROLE',
            message: 'Only users with the Creator role can create campaigns.',
            correlation_id: req.id,
          },
        });
        return;
      }

      const parseResult = createCampaignSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: zodErrorMessage(parseResult.error),
            details: zodErrorDetails(parseResult.error),
            correlation_id: req.id,
          },
        });
        return;
      }

      const data = parseResult.data;

      try {
        const result = await campaignAppService.createDraft(userId, {
          title: data.title,
          category: data.category,
          minFundingTargetCents: data.min_funding_target_cents,
          maxFundingCapCents: data.max_funding_cap_cents,
          summary: data.summary,
          description: data.description,
          marsAlignmentStatement: data.mars_alignment_statement,
          deadline: data.deadline ?? null,
          budgetBreakdown: data.budget_breakdown,
          teamInfo: data.team_info,
          riskDisclosures: data.risk_disclosures,
          heroImageUrl: data.hero_image_url,
          milestones: data.milestones?.map((m) => ({
            title: m.title,
            description: m.description,
            targetDate: m.target_date ?? null,
            fundingPercentage: m.funding_percentage,
            verificationCriteria: m.verification_criteria,
          })),
        });

        res.status(201).json({ data: formatCampaignResult(result) });
      } catch (err) {
        if (err instanceof InvalidCampaignError) {
          res.status(400).json({
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
   * GET /api/v1/campaigns/review-queue — List submitted/under_review campaigns for reviewer
   * NOTE: Must be registered BEFORE /:id to avoid param collision
   * Requires: reviewer or administrator role
   */
  router.get('/api/v1/campaigns/review-queue', async (req, res, next) => {
    try {
      const userId = req.authContext?.userId;
      if (!userId) {
        res.status(401).json({
          error: { code: 'UNAUTHENTICATED', message: 'Authentication required.', correlation_id: req.id },
        });
        return;
      }

      const roles = req.authContext?.roles ?? [];

      try {
        const results = await campaignAppService.listSubmittedCampaigns(userId, roles);
        res.status(200).json({ data: results.map(formatCampaignResult) });
      } catch (err) {
        if (err instanceof InsufficientRoleError) {
          res.status(403).json({
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
   * GET /api/v1/campaigns/mine — List authenticated user's campaigns
   * NOTE: Must be registered BEFORE /:id to avoid param collision
   */
  router.get('/api/v1/campaigns/mine', async (req, res, next) => {
    try {
      const userId = req.authContext?.userId;
      if (!userId) {
        res.status(401).json({
          error: { code: 'UNAUTHENTICATED', message: 'Authentication required.', correlation_id: req.id },
        });
        return;
      }

      const results = await campaignAppService.listMyCampaigns(userId);
      res.status(200).json({ data: results.map(formatCampaignResult) });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/v1/campaigns/:id — Get a campaign by ID (creator-scoped)
   */
  router.get('/api/v1/campaigns/:id', async (req, res, next) => {
    try {
      const userId = req.authContext?.userId;
      if (!userId) {
        res.status(401).json({
          error: { code: 'UNAUTHENTICATED', message: 'Authentication required.', correlation_id: req.id },
        });
        return;
      }

      const { id } = req.params;
      if (!id) {
        res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'Campaign ID is required.', correlation_id: req.id },
        });
        return;
      }

      try {
        const result = await campaignAppService.getCampaign(userId, id);
        res.status(200).json({ data: formatCampaignResult(result) });
      } catch (err) {
        if (err instanceof CampaignNotFoundError) {
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
   * PATCH /api/v1/campaigns/:id — Update a draft campaign
   */
  router.patch('/api/v1/campaigns/:id', async (req, res, next) => {
    try {
      const userId = req.authContext?.userId;
      if (!userId) {
        res.status(401).json({
          error: { code: 'UNAUTHENTICATED', message: 'Authentication required.', correlation_id: req.id },
        });
        return;
      }

      const { id } = req.params;
      if (!id) {
        res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'Campaign ID is required.', correlation_id: req.id },
        });
        return;
      }

      if (!req.body || Object.keys(req.body as object).length === 0) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'At least one field must be provided.',
            correlation_id: req.id,
          },
        });
        return;
      }

      const parseResult = updateCampaignSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: zodErrorMessage(parseResult.error),
            details: zodErrorDetails(parseResult.error),
            correlation_id: req.id,
          },
        });
        return;
      }

      const data = parseResult.data;

      try {
        const result = await campaignAppService.updateDraft(userId, id, {
          title: data.title,
          summary: data.summary,
          description: data.description,
          marsAlignmentStatement: data.mars_alignment_statement,
          category: data.category,
          minFundingTargetCents: data.min_funding_target_cents ?? undefined,
          maxFundingCapCents: data.max_funding_cap_cents ?? undefined,
          deadline: data.deadline !== undefined ? (data.deadline ?? null) : undefined,
          budgetBreakdown: data.budget_breakdown,
          teamInfo: data.team_info,
          riskDisclosures: data.risk_disclosures,
          heroImageUrl: data.hero_image_url,
          milestones:
            data.milestones !== undefined && data.milestones !== null
              ? data.milestones.map((m) => ({
                  title: m.title,
                  description: m.description,
                  targetDate: m.target_date ?? null,
                  fundingPercentage: m.funding_percentage,
                  verificationCriteria: m.verification_criteria,
                }))
              : undefined,
        });

        res.status(200).json({ data: formatCampaignResult(result) });
      } catch (err) {
        if (err instanceof CampaignNotFoundError) {
          res.status(404).json({
            error: { code: err.code, message: err.message, correlation_id: req.id },
          });
          return;
        }
        if (err instanceof CampaignAlreadySubmittedError) {
          res.status(409).json({
            error: { code: err.code, message: err.message, correlation_id: req.id },
          });
          return;
        }
        if (err instanceof InvalidCampaignError) {
          res.status(400).json({
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
   * POST /api/v1/campaigns/:id/submit — Submit a draft campaign for review
   */
  router.post('/api/v1/campaigns/:id/submit', async (req, res, next) => {
    try {
      const userId = req.authContext?.userId;
      if (!userId) {
        res.status(401).json({
          error: { code: 'UNAUTHENTICATED', message: 'Authentication required.', correlation_id: req.id },
        });
        return;
      }

      const { id } = req.params;
      if (!id) {
        res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'Campaign ID is required.', correlation_id: req.id },
        });
        return;
      }

      try {
        const result = await campaignAppService.submitForReview(userId, id);
        res.status(200).json({ data: formatCampaignResult(result) });
      } catch (err) {
        if (err instanceof KycRequiredError) {
          res.status(403).json({
            error: { code: err.code, message: err.message, correlation_id: req.id },
          });
          return;
        }
        if (err instanceof CampaignNotFoundError) {
          res.status(404).json({
            error: { code: err.code, message: err.message, correlation_id: req.id },
          });
          return;
        }
        if (err instanceof CampaignAlreadySubmittedError) {
          res.status(409).json({
            error: { code: err.code, message: err.message, correlation_id: req.id },
          });
          return;
        }
        if (err instanceof InvalidCampaignError) {
          res.status(400).json({
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
        throw err;
      }
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/v1/campaigns/:id/claim — Claim a submitted campaign for review
   * Requires: reviewer or administrator role
   */
  router.post('/api/v1/campaigns/:id/claim', async (req, res, next) => {
    try {
      const userId = req.authContext?.userId;
      if (!userId) {
        res.status(401).json({
          error: { code: 'UNAUTHENTICATED', message: 'Authentication required.', correlation_id: req.id },
        });
        return;
      }

      const { id } = req.params;
      if (!id) {
        res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'Campaign ID is required.', correlation_id: req.id },
        });
        return;
      }

      const roles = req.authContext?.roles ?? [];
      const hasReviewerRole = roles.some((r) => REVIEWER_ROLES.includes(r as AccountRole));
      if (!hasReviewerRole) {
        res.status(403).json({
          error: {
            code: 'INSUFFICIENT_ROLE',
            message: 'Only reviewers or administrators can claim campaigns.',
            correlation_id: req.id,
          },
        });
        return;
      }

      try {
        const result = await campaignAppService.startReview(userId, id, roles);
        res.status(200).json({ data: formatCampaignResult(result) });
      } catch (err) {
        if (err instanceof CampaignNotFoundError) {
          res.status(404).json({
            error: { code: err.code, message: err.message, correlation_id: req.id },
          });
          return;
        }
        if (err instanceof CampaignNotReviewableError) {
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
        throw err;
      }
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/v1/campaigns/:id/approve — Approve a campaign under review
   * Requires: reviewer or administrator role; must be the assigned reviewer
   */
  router.post('/api/v1/campaigns/:id/approve', async (req, res, next) => {
    try {
      const userId = req.authContext?.userId;
      if (!userId) {
        res.status(401).json({
          error: { code: 'UNAUTHENTICATED', message: 'Authentication required.', correlation_id: req.id },
        });
        return;
      }

      const { id } = req.params;
      if (!id) {
        res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'Campaign ID is required.', correlation_id: req.id },
        });
        return;
      }

      const roles = req.authContext?.roles ?? [];
      const hasReviewerRole = roles.some((r) => REVIEWER_ROLES.includes(r as AccountRole));
      if (!hasReviewerRole) {
        res.status(403).json({
          error: {
            code: 'INSUFFICIENT_ROLE',
            message: 'Only reviewers or administrators can approve campaigns.',
            correlation_id: req.id,
          },
        });
        return;
      }

      const parseResult = reviewCommentSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: zodErrorMessage(parseResult.error),
            details: zodErrorDetails(parseResult.error),
            correlation_id: req.id,
          },
        });
        return;
      }

      try {
        const result = await campaignAppService.approveCampaign(
          userId,
          id,
          parseResult.data.comment,
          roles,
        );
        res.status(200).json({ data: formatCampaignResult(result) });
      } catch (err) {
        if (err instanceof CampaignNotFoundError) {
          res.status(404).json({
            error: { code: err.code, message: err.message, correlation_id: req.id },
          });
          return;
        }
        if (err instanceof CampaignNotReviewableError) {
          res.status(409).json({
            error: { code: err.code, message: err.message, correlation_id: req.id },
          });
          return;
        }
        if (err instanceof ReviewerCommentRequiredError) {
          res.status(400).json({
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
        throw err;
      }
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/v1/campaigns/:id/reject — Reject a campaign under review
   * Requires: reviewer or administrator role; must be the assigned reviewer
   */
  router.post('/api/v1/campaigns/:id/reject', async (req, res, next) => {
    try {
      const userId = req.authContext?.userId;
      if (!userId) {
        res.status(401).json({
          error: { code: 'UNAUTHENTICATED', message: 'Authentication required.', correlation_id: req.id },
        });
        return;
      }

      const { id } = req.params;
      if (!id) {
        res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'Campaign ID is required.', correlation_id: req.id },
        });
        return;
      }

      const roles = req.authContext?.roles ?? [];
      const hasReviewerRole = roles.some((r) => REVIEWER_ROLES.includes(r as AccountRole));
      if (!hasReviewerRole) {
        res.status(403).json({
          error: {
            code: 'INSUFFICIENT_ROLE',
            message: 'Only reviewers or administrators can reject campaigns.',
            correlation_id: req.id,
          },
        });
        return;
      }

      const parseResult = reviewCommentSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: zodErrorMessage(parseResult.error),
            details: zodErrorDetails(parseResult.error),
            correlation_id: req.id,
          },
        });
        return;
      }

      try {
        const result = await campaignAppService.rejectCampaign(
          userId,
          id,
          parseResult.data.comment,
          roles,
        );
        res.status(200).json({ data: formatCampaignResult(result) });
      } catch (err) {
        if (err instanceof CampaignNotFoundError) {
          res.status(404).json({
            error: { code: err.code, message: err.message, correlation_id: req.id },
          });
          return;
        }
        if (err instanceof CampaignNotReviewableError) {
          res.status(409).json({
            error: { code: err.code, message: err.message, correlation_id: req.id },
          });
          return;
        }
        if (err instanceof ReviewerCommentRequiredError) {
          res.status(400).json({
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
        throw err;
      }
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/v1/campaigns/:id/recuse — Reviewer recuses from a campaign
   * Requires: reviewer or administrator role; must be the assigned reviewer
   */
  router.post('/api/v1/campaigns/:id/recuse', async (req, res, next) => {
    try {
      const userId = req.authContext?.userId;
      if (!userId) {
        res.status(401).json({
          error: { code: 'UNAUTHENTICATED', message: 'Authentication required.', correlation_id: req.id },
        });
        return;
      }

      const { id } = req.params;
      if (!id) {
        res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'Campaign ID is required.', correlation_id: req.id },
        });
        return;
      }

      const roles = req.authContext?.roles ?? [];
      const hasReviewerRole = roles.some((r) => REVIEWER_ROLES.includes(r as AccountRole));
      if (!hasReviewerRole) {
        res.status(403).json({
          error: {
            code: 'INSUFFICIENT_ROLE',
            message: 'Only reviewers or administrators can recuse from campaigns.',
            correlation_id: req.id,
          },
        });
        return;
      }

      try {
        const result = await campaignAppService.recuseCampaign(userId, id, roles);
        res.status(200).json({ data: formatCampaignResult(result) });
      } catch (err) {
        if (err instanceof CampaignNotFoundError) {
          res.status(404).json({
            error: { code: err.code, message: err.message, correlation_id: req.id },
          });
          return;
        }
        if (err instanceof CampaignNotReviewableError) {
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
        throw err;
      }
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/v1/campaigns/:id/return-to-draft — Creator revises a rejected campaign
   * Requires: authenticated user who owns the campaign
   */
  router.post('/api/v1/campaigns/:id/return-to-draft', async (req, res, next) => {
    try {
      const userId = req.authContext?.userId;
      if (!userId) {
        res.status(401).json({
          error: { code: 'UNAUTHENTICATED', message: 'Authentication required.', correlation_id: req.id },
        });
        return;
      }

      const { id } = req.params;
      if (!id) {
        res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'Campaign ID is required.', correlation_id: req.id },
        });
        return;
      }

      try {
        const result = await campaignAppService.returnCampaignToDraft(userId, id);
        res.status(200).json({ data: formatCampaignResult(result) });
      } catch (err) {
        if (err instanceof CampaignNotFoundError) {
          res.status(404).json({
            error: { code: err.code, message: err.message, correlation_id: req.id },
          });
          return;
        }
        if (err instanceof CampaignNotReviewableError) {
          res.status(409).json({
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
