import type { Application } from 'express';
import express from 'express';
import pino from 'pino';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryUserRepository } from '../../account/adapters/in-memory-user-repository.adapter.js';
import { User, type UserData } from '../../account/domain/models/user.js';
import { AccountStatus } from '../../account/domain/value-objects/account-status.js';
import { KycStatus } from '../../account/domain/value-objects/kyc-status.js';
import { NotificationPreferences } from '../../account/domain/value-objects/notification-preferences.js';
import { Role } from '../../account/domain/value-objects/role.js';
import { correlationIdMiddleware } from '../../shared/middleware/auth.js';
import { createErrorHandler } from '../../shared/middleware/error-handler.js';
import { InMemoryCampaignAuditRepository } from '../adapters/in-memory-campaign-audit-repository.adapter.js';
import { InMemoryCampaignRepository } from '../adapters/in-memory-campaign-repository.adapter.js';
import { CampaignAppService } from '../application/campaign-app-service.js';
import { Campaign } from '../domain/models/campaign.js';
import { CampaignStatus } from '../domain/value-objects/campaign-status.js';
import { createPublicCampaignRouter } from './public-campaign-router.js';

// Mock @clerk/express to avoid real Clerk JWT validation in tests (G-012)
vi.mock('@clerk/express', () => ({
  clerkMiddleware:
    () => (_req: express.Request, _res: express.Response, next: express.NextFunction) =>
      next(),
  requireAuth: () => (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const userId = req.headers['x-test-user-id'] as string | undefined;
    if (!userId) {
      res.status(401).json({
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Authentication required. Sign in to continue.',
          correlation_id: null,
        },
      });
      return;
    }
    next();
  },
  getAuth: (req: express.Request) => {
    const userId = req.headers['x-test-user-id'] as string | undefined;
    return { userId: userId ?? null };
  },
}));

const logger = pino({ level: 'silent' });

function makeUserId(): string {
  return crypto.randomUUID();
}

function makeCreatorUser(internalId: string, clerkId: string): User {
  const data: UserData = {
    id: internalId,
    clerkUserId: clerkId,
    email: `creator-${internalId}@example.com`,
    displayName: `Creator ${internalId.slice(0, 8)}`,
    bio: null,
    avatarUrl: null,
    roles: [Role.Creator],
    accountStatus: AccountStatus.Active,
    kycStatus: KycStatus.Verified,
    notificationPrefs: NotificationPreferences.defaults(),
    onboardingCompleted: true,
    onboardingStep: null,
    lastSeenAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  return User.reconstitute(data);
}

function makeLiveCampaign(creatorUserId: string): Campaign {
  const now = new Date();
  const deadline = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
  return Campaign.reconstitute({
    id: crypto.randomUUID(),
    creatorUserId,
    title: 'Test Live Campaign',
    shortDescription: 'A campaign for nuclear propulsion systems',
    description: 'Full description of the nuclear propulsion mission',
    category: 'propulsion',
    heroImageUrl: 'https://example.com/hero.jpg',
    fundingGoalCents: '100000000', // $1M
    fundingCapCents: '200000000', // $2M
    deadline,
    milestones: [
      {
        id: crypto.randomUUID(),
        title: 'Phase 1',
        description: 'Initial phase',
        fundingBasisPoints: 5000,
        targetDate: null,
      },
      {
        id: crypto.randomUUID(),
        title: 'Phase 2',
        description: 'Final phase',
        fundingBasisPoints: 5000,
        targetDate: null,
      },
    ],
    teamMembers: [
      {
        id: crypto.randomUUID(),
        name: 'Alice',
        role: 'Lead Engineer',
        bio: 'Expert in propulsion',
      },
    ],
    riskDisclosures: [
      { id: crypto.randomUUID(), risk: 'Technical risk', mitigation: 'Redundant systems' },
    ],
    budgetBreakdown: [
      {
        id: crypto.randomUUID(),
        category: 'R&D',
        description: 'Research',
        estimatedCents: '50000000',
      },
    ],
    alignmentStatement: 'This mission aligns with Mars colonization goals',
    tags: ['propulsion', 'nuclear'],
    status: CampaignStatus.Live,
    rejectionReason: null,
    resubmissionGuidance: null,
    reviewNotes: null,
    reviewedByUserId: null,
    reviewedAt: null,
    submittedAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
    launchedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
    createdAt: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
  });
}

function makeFundedCampaign(creatorUserId: string): Campaign {
  const now = new Date();
  const deadline = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
  return Campaign.reconstitute({
    id: crypto.randomUUID(),
    creatorUserId,
    title: 'Test Funded Campaign',
    shortDescription: 'A funded power energy campaign',
    description: 'Full description of the power energy mission',
    category: 'power_energy',
    heroImageUrl: null,
    fundingGoalCents: '150000000',
    fundingCapCents: '300000000',
    deadline,
    milestones: [],
    teamMembers: [],
    riskDisclosures: [],
    budgetBreakdown: [],
    alignmentStatement: null,
    tags: [],
    status: CampaignStatus.Funded,
    rejectionReason: null,
    resubmissionGuidance: null,
    reviewNotes: null,
    reviewedByUserId: null,
    reviewedAt: null,
    submittedAt: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000),
    launchedAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
    createdAt: new Date(now.getTime() - 25 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
  });
}

function makeDraftCampaign(creatorUserId: string): Campaign {
  return Campaign.reconstitute({
    id: crypto.randomUUID(),
    creatorUserId,
    title: 'Draft Campaign',
    shortDescription: null,
    description: null,
    category: 'robotics_automation',
    heroImageUrl: null,
    fundingGoalCents: null,
    fundingCapCents: null,
    deadline: null,
    milestones: [],
    teamMembers: [],
    riskDisclosures: [],
    budgetBreakdown: [],
    alignmentStatement: null,
    tags: [],
    status: CampaignStatus.Draft,
    rejectionReason: null,
    resubmissionGuidance: null,
    reviewNotes: null,
    reviewedByUserId: null,
    reviewedAt: null,
    submittedAt: null,
    launchedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function buildApp(
  campaignRepo: InMemoryCampaignRepository,
  userRepo: InMemoryUserRepository,
): Application {
  const app = express();
  app.use(correlationIdMiddleware);
  app.use(express.json());

  const auditRepo = new InMemoryCampaignAuditRepository();
  const campaignAppService = new CampaignAppService(campaignRepo, auditRepo, userRepo, logger);

  // Public routes — NO requireAuth
  app.use('/api/v1/public/campaigns', createPublicCampaignRouter(campaignAppService, logger));

  app.use(createErrorHandler(logger));
  return app;
}

describe('Public Campaign Router', () => {
  let campaignRepo: InMemoryCampaignRepository;
  let userRepo: InMemoryUserRepository;
  let app: Application;
  let creatorInternalId: string;
  let liveCampaign: Campaign;
  let fundedCampaign: Campaign;
  let draftCampaign: Campaign;

  beforeEach(() => {
    campaignRepo = new InMemoryCampaignRepository();
    userRepo = new InMemoryUserRepository();

    creatorInternalId = makeUserId();
    const clerkId = `user_${makeUserId()}`;
    const creator = makeCreatorUser(creatorInternalId, clerkId);
    userRepo.users.set(creator.id, creator);

    liveCampaign = makeLiveCampaign(creatorInternalId);
    fundedCampaign = makeFundedCampaign(creatorInternalId);
    draftCampaign = makeDraftCampaign(creatorInternalId);

    campaignRepo.campaigns.set(liveCampaign.id, liveCampaign);
    campaignRepo.campaigns.set(fundedCampaign.id, fundedCampaign);
    campaignRepo.campaigns.set(draftCampaign.id, draftCampaign);

    app = buildApp(campaignRepo, userRepo);
  });

  // ─── GET / ────────────────────────────────────────────────────────────────

  describe('GET /api/v1/public/campaigns', () => {
    it('returns 200 with paginated results for anonymous users (no auth header)', async () => {
      // No x-test-user-id header — anonymous request
      const response = await request(app).get('/api/v1/public/campaigns').expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('returns only live and funded campaigns (not draft)', async () => {
      const response = await request(app).get('/api/v1/public/campaigns').expect(200);

      const ids = response.body.data.map((c: { id: string }) => c.id);
      expect(ids).toContain(liveCampaign.id);
      expect(ids).toContain(fundedCampaign.id);
      expect(ids).not.toContain(draftCampaign.id);
    });

    it('returns correct list item fields', async () => {
      const response = await request(app).get('/api/v1/public/campaigns').expect(200);

      const liveItem = response.body.data.find((c: { id: string }) => c.id === liveCampaign.id);
      expect(liveItem).toBeDefined();
      expect(liveItem).toHaveProperty('id');
      expect(liveItem).toHaveProperty('title', liveCampaign.title);
      expect(liveItem).toHaveProperty('shortDescription');
      expect(liveItem).toHaveProperty('category');
      expect(liveItem).toHaveProperty('heroImageUrl');
      expect(liveItem).toHaveProperty('status', 'live');
      expect(liveItem).toHaveProperty('fundingGoalCents');
      expect(liveItem).toHaveProperty('totalRaisedCents', '0');
      expect(liveItem).toHaveProperty('contributorCount', 0);
      expect(liveItem).toHaveProperty('fundingPercentage');
      expect(liveItem).toHaveProperty('deadline');
      expect(liveItem).toHaveProperty('daysRemaining');
      expect(liveItem).toHaveProperty('launchedAt');
      expect(liveItem).toHaveProperty('creatorName');
    });

    it('returns 200 with empty array when no campaigns match filter', async () => {
      const response = await request(app)
        .get('/api/v1/public/campaigns?category=communications_navigation')
        .expect(200);

      expect(response.body.data).toEqual([]);
      expect(response.body.pagination.total).toBe(0);
    });

    it('filters by category', async () => {
      const response = await request(app)
        .get('/api/v1/public/campaigns?category=propulsion')
        .expect(200);

      const ids = response.body.data.map((c: { id: string }) => c.id);
      expect(ids).toContain(liveCampaign.id);
      expect(ids).not.toContain(fundedCampaign.id);
    });

    it('filters by status=active (live campaigns only)', async () => {
      const response = await request(app).get('/api/v1/public/campaigns?status=active').expect(200);

      const statuses = response.body.data.map((c: { status: string }) => c.status);
      expect(statuses).not.toContain('funded');
      statuses.forEach((s: string) => expect(s).toBe('live'));
    });

    it('filters by status=funded (funded campaigns only)', async () => {
      const response = await request(app).get('/api/v1/public/campaigns?status=funded').expect(200);

      const statuses = response.body.data.map((c: { status: string }) => c.status);
      expect(statuses).not.toContain('live');
      statuses.forEach((s: string) => expect(s).toBe('funded'));
    });

    it('applies pagination correctly', async () => {
      const response = await request(app)
        .get('/api/v1/public/campaigns?limit=1&offset=0')
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.pagination.limit).toBe(1);
      expect(response.body.pagination.offset).toBe(0);
      expect(response.body.pagination.total).toBe(2); // live + funded
    });

    it('returns 400 for invalid category value', async () => {
      const response = await request(app)
        .get('/api/v1/public/campaigns?category=invalid_category')
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for invalid sort value', async () => {
      const response = await request(app)
        .get('/api/v1/public/campaigns?sort=invalid_sort')
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when limit exceeds 100', async () => {
      const response = await request(app).get('/api/v1/public/campaigns?limit=101').expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 200 even when authenticated (auth not required)', async () => {
      const response = await request(app)
        .get('/api/v1/public/campaigns')
        .set('x-test-user-id', makeUserId())
        .expect(200);

      expect(response.body).toHaveProperty('data');
    });

    it('returns totalRaisedCents as string "0" for all items (feat-004 stub)', async () => {
      const response = await request(app).get('/api/v1/public/campaigns').expect(200);

      for (const item of response.body.data) {
        expect(item.totalRaisedCents).toBe('0');
        expect(item.contributorCount).toBe(0);
      }
    });
  });

  // ─── GET /stats ───────────────────────────────────────────────────────────

  describe('GET /api/v1/public/campaigns/stats', () => {
    it('returns 200 with category stats for anonymous users', async () => {
      const response = await request(app)
        .get('/api/v1/public/campaigns/stats?category=propulsion')
        .expect(200);

      expect(response.body.data).toHaveProperty('category', 'propulsion');
      expect(response.body.data).toHaveProperty('campaignCount');
      expect(response.body.data).toHaveProperty('activeCampaignCount');
      expect(response.body.data).toHaveProperty('totalRaisedCents', '0');
      expect(response.body.data).toHaveProperty('contributorCount', 0);
    });

    it('counts live and funded campaigns for category', async () => {
      const response = await request(app)
        .get('/api/v1/public/campaigns/stats?category=propulsion')
        .expect(200);

      // We have 1 live propulsion campaign
      expect(response.body.data.campaignCount).toBe(1);
      expect(response.body.data.activeCampaignCount).toBe(1);
    });

    it('returns zero counts for category with no campaigns', async () => {
      const response = await request(app)
        .get('/api/v1/public/campaigns/stats?category=communications_navigation')
        .expect(200);

      expect(response.body.data.campaignCount).toBe(0);
      expect(response.body.data.activeCampaignCount).toBe(0);
    });

    it('returns 400 when category is missing', async () => {
      const response = await request(app).get('/api/v1/public/campaigns/stats').expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for invalid category value', async () => {
      const response = await request(app)
        .get('/api/v1/public/campaigns/stats?category=invalid')
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ─── GET /:id ─────────────────────────────────────────────────────────────

  describe('GET /api/v1/public/campaigns/:id', () => {
    it('returns 200 with full detail for a live campaign (anonymous)', async () => {
      const response = await request(app)
        .get(`/api/v1/public/campaigns/${liveCampaign.id}`)
        .expect(200);

      const data = response.body.data;
      expect(data.id).toBe(liveCampaign.id);
      expect(data.status).toBe('live');
      expect(data).toHaveProperty('description');
      expect(data).toHaveProperty('milestones');
      expect(data).toHaveProperty('teamMembers');
      expect(data).toHaveProperty('riskDisclosures');
      expect(data).toHaveProperty('budgetBreakdown');
      expect(data).toHaveProperty('alignmentStatement');
      expect(data).toHaveProperty('tags');
      expect(data).toHaveProperty('fundingCapCents');
      expect(data).toHaveProperty('totalRaisedCents', '0');
      expect(data).toHaveProperty('contributorCount', 0);
      expect(data).toHaveProperty('daysRemaining');
    });

    it('returns 200 with full detail for a funded campaign', async () => {
      const response = await request(app)
        .get(`/api/v1/public/campaigns/${fundedCampaign.id}`)
        .expect(200);

      expect(response.body.data.status).toBe('funded');
    });

    it('returns 404 for a draft campaign (do not reveal existence)', async () => {
      const response = await request(app)
        .get(`/api/v1/public/campaigns/${draftCampaign.id}`)
        .expect(404);

      expect(response.body.error.code).toBe('CAMPAIGN_NOT_FOUND');
    });

    it('returns 404 for a non-existent campaign', async () => {
      const nonExistentId = crypto.randomUUID();
      const response = await request(app)
        .get(`/api/v1/public/campaigns/${nonExistentId}`)
        .expect(404);

      expect(response.body.error.code).toBe('CAMPAIGN_NOT_FOUND');
    });

    it('returns 404 for a malformed ID (no 400 — security)', async () => {
      // Non-UUID format — PostgreSQL will reject and return no rows = 404
      const response = await request(app)
        .get('/api/v1/public/campaigns/not-a-valid-uuid')
        .expect(404);

      expect(response.body.error.code).toBe('CAMPAIGN_NOT_FOUND');
    });

    it('returns fundingPercentage as null when fundingGoalCents is null', async () => {
      // Create a live campaign with no funding goal
      const noGoalCampaign = Campaign.reconstitute({
        id: crypto.randomUUID(),
        creatorUserId: creatorInternalId,
        title: 'No Goal Campaign',
        shortDescription: null,
        description: null,
        category: 'propulsion',
        heroImageUrl: null,
        fundingGoalCents: null,
        fundingCapCents: null,
        deadline: null,
        milestones: [],
        teamMembers: [],
        riskDisclosures: [],
        budgetBreakdown: [],
        alignmentStatement: null,
        tags: [],
        status: CampaignStatus.Live,
        rejectionReason: null,
        resubmissionGuidance: null,
        reviewNotes: null,
        reviewedByUserId: null,
        reviewedAt: null,
        submittedAt: null,
        launchedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      campaignRepo.campaigns.set(noGoalCampaign.id, noGoalCampaign);

      const response = await request(app)
        .get(`/api/v1/public/campaigns/${noGoalCampaign.id}`)
        .expect(200);

      expect(response.body.data.fundingPercentage).toBeNull();
    });

    it('computes daysRemaining correctly', async () => {
      const response = await request(app)
        .get(`/api/v1/public/campaigns/${liveCampaign.id}`)
        .expect(200);

      const daysRemaining = response.body.data.daysRemaining;
      expect(typeof daysRemaining).toBe('number');
      expect(daysRemaining).toBeGreaterThan(0); // 30 days deadline
    });

    it('returns daysRemaining as null when deadline is null', async () => {
      const noDeadlineCampaign = Campaign.reconstitute({
        id: crypto.randomUUID(),
        creatorUserId: creatorInternalId,
        title: 'No Deadline Campaign',
        shortDescription: null,
        description: null,
        category: 'propulsion',
        heroImageUrl: null,
        fundingGoalCents: '100000000',
        fundingCapCents: null,
        deadline: null,
        milestones: [],
        teamMembers: [],
        riskDisclosures: [],
        budgetBreakdown: [],
        alignmentStatement: null,
        tags: [],
        status: CampaignStatus.Live,
        rejectionReason: null,
        resubmissionGuidance: null,
        reviewNotes: null,
        reviewedByUserId: null,
        reviewedAt: null,
        submittedAt: null,
        launchedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      campaignRepo.campaigns.set(noDeadlineCampaign.id, noDeadlineCampaign);

      const response = await request(app)
        .get(`/api/v1/public/campaigns/${noDeadlineCampaign.id}`)
        .expect(200);

      expect(response.body.data.daysRemaining).toBeNull();
    });
  });
});
