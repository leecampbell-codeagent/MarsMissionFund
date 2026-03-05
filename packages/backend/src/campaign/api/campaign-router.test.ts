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
import { createCampaignRouter } from './campaign-router.js';

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

// Use stable deterministic UUIDs for test users
const TEST_USER_IDS: Record<string, string> = {};
function getTestUserId(clerkUserId: string): string {
  if (!TEST_USER_IDS[clerkUserId]) {
    TEST_USER_IDS[clerkUserId] = crypto.randomUUID();
  }
  return TEST_USER_IDS[clerkUserId];
}

function makeUserData(clerkUserId: string, overrides: Partial<UserData> = {}): UserData {
  return {
    id: getTestUserId(clerkUserId),
    clerkUserId,
    email: `${clerkUserId}@test.mmf`,
    displayName: null,
    bio: null,
    avatarUrl: null,
    accountStatus: AccountStatus.Active,
    onboardingCompleted: false,
    onboardingStep: null,
    roles: [Role.Creator, Role.Backer],
    notificationPrefs: NotificationPreferences.defaults(),
    kycStatus: KycStatus.Verified,
    lastSeenAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function seedUser(
  repo: InMemoryUserRepository,
  clerkUserId: string,
  overrides: Partial<UserData> = {},
): User {
  const data = makeUserData(clerkUserId, overrides);
  const user = User.reconstitute(data);
  repo.users.set(clerkUserId, user);
  return user;
}

function createTestApp(): {
  app: Application;
  userRepo: InMemoryUserRepository;
  campaignRepo: InMemoryCampaignRepository;
  auditRepo: InMemoryCampaignAuditRepository;
} {
  const userRepo = new InMemoryUserRepository();
  const campaignRepo = new InMemoryCampaignRepository();
  const auditRepo = new InMemoryCampaignAuditRepository();
  const service = new CampaignAppService(campaignRepo, auditRepo, userRepo, logger);

  const app = express();
  app.use(correlationIdMiddleware);
  app.use(express.json());
  app.use('/api/v1/campaigns', createCampaignRouter(service, logger));
  app.use(createErrorHandler(logger));

  return { app, userRepo, campaignRepo, auditRepo };
}

describe('POST /api/v1/campaigns', () => {
  let app: Application;
  let userRepo: InMemoryUserRepository;

  beforeEach(() => {
    ({ app, userRepo } = createTestApp());
  });

  it('creates a campaign draft — 201', async () => {
    seedUser(userRepo, 'creator_001');

    const res = await request(app)
      .post('/api/v1/campaigns')
      .set('x-test-user-id', 'creator_001')
      .send({ title: 'HelioShield: Mars Radiation Protection' });

    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe('HelioShield: Mars Radiation Protection');
    expect(res.body.data.status).toBe('draft');
    expect(res.body.data.id).toBeDefined();
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).post('/api/v1/campaigns').send({ title: 'Test' });

    expect(res.status).toBe(401);
  });

  it('returns 400 for missing title', async () => {
    seedUser(userRepo, 'creator_001');

    const res = await request(app)
      .post('/api/v1/campaigns')
      .set('x-test-user-id', 'creator_001')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 403 CREATOR_ROLE_REQUIRED for user without creator role', async () => {
    seedUser(userRepo, 'backer_001', { roles: [Role.Backer] });

    const res = await request(app)
      .post('/api/v1/campaigns')
      .set('x-test-user-id', 'backer_001')
      .send({ title: 'Test' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CREATOR_ROLE_REQUIRED');
  });

  it('returns 403 KYC_NOT_VERIFIED for unverified user', async () => {
    seedUser(userRepo, 'creator_001', { kycStatus: KycStatus.NotStarted });

    const res = await request(app)
      .post('/api/v1/campaigns')
      .set('x-test-user-id', 'creator_001')
      .send({ title: 'Test' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('KYC_NOT_VERIFIED');
  });
});

describe('GET /api/v1/campaigns/:id', () => {
  let app: Application;
  let userRepo: InMemoryUserRepository;
  let campaignRepo: InMemoryCampaignRepository;

  beforeEach(() => {
    ({ app, userRepo, campaignRepo } = createTestApp());
  });

  it('returns campaign for owner — 200', async () => {
    const user = seedUser(userRepo, 'creator_001');
    const campaign = Campaign.create({ creatorUserId: user.id, title: 'My Campaign' });
    await campaignRepo.save(campaign);

    const res = await request(app)
      .get(`/api/v1/campaigns/${campaign.id}`)
      .set('x-test-user-id', 'creator_001');

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(campaign.id);
    expect(res.body.data.status).toBe('draft');
  });

  it('returns 404 for non-existent campaign', async () => {
    seedUser(userRepo, 'creator_001');

    const res = await request(app)
      .get('/api/v1/campaigns/non-existent-id')
      .set('x-test-user-id', 'creator_001');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('CAMPAIGN_NOT_FOUND');
  });

  it('returns 404 when reviewer tries to view a draft', async () => {
    const creator = seedUser(userRepo, 'creator_001');
    seedUser(userRepo, 'reviewer_001', { roles: [Role.Reviewer, Role.Backer] });
    const campaign = Campaign.create({ creatorUserId: creator.id, title: 'Draft' });
    await campaignRepo.save(campaign);

    const res = await request(app)
      .get(`/api/v1/campaigns/${campaign.id}`)
      .set('x-test-user-id', 'reviewer_001');

    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/v1/campaigns/:id', () => {
  let app: Application;
  let userRepo: InMemoryUserRepository;
  let campaignRepo: InMemoryCampaignRepository;

  beforeEach(() => {
    ({ app, userRepo, campaignRepo } = createTestApp());
  });

  it('updates draft fields — 200', async () => {
    const user = seedUser(userRepo, 'creator_001');
    const campaign = Campaign.create({ creatorUserId: user.id, title: 'Original' });
    await campaignRepo.save(campaign);

    const res = await request(app)
      .patch(`/api/v1/campaigns/${campaign.id}`)
      .set('x-test-user-id', 'creator_001')
      .send({ title: 'Updated Title', shortDescription: 'New short desc' });

    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Updated Title');
    expect(res.body.data.shortDescription).toBe('New short desc');
  });

  it('returns 400 for empty body', async () => {
    const user = seedUser(userRepo, 'creator_001');
    const campaign = Campaign.create({ creatorUserId: user.id, title: 'Original' });
    await campaignRepo.save(campaign);

    const res = await request(app)
      .patch(`/api/v1/campaigns/${campaign.id}`)
      .set('x-test-user-id', 'creator_001')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 409 CAMPAIGN_NOT_EDITABLE for submitted campaign', async () => {
    const user = seedUser(userRepo, 'creator_001');
    const campaign = Campaign.create({ creatorUserId: user.id, title: 'Camp' });
    await campaignRepo.save(campaign);
    await campaignRepo.updateStatus(campaign.id, 'draft', 'submitted', { submittedAt: new Date() });

    const res = await request(app)
      .patch(`/api/v1/campaigns/${campaign.id}`)
      .set('x-test-user-id', 'creator_001')
      .send({ title: 'Updated' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CAMPAIGN_NOT_EDITABLE');
  });
});

describe('GET /api/v1/campaigns/review-queue', () => {
  let app: Application;
  let userRepo: InMemoryUserRepository;
  let campaignRepo: InMemoryCampaignRepository;

  beforeEach(() => {
    ({ app, userRepo, campaignRepo } = createTestApp());
  });

  it('returns submitted campaigns for reviewer — 200', async () => {
    const creator = seedUser(userRepo, 'creator_001');
    seedUser(userRepo, 'reviewer_001', { roles: [Role.Reviewer, Role.Backer] });
    const campaign = Campaign.create({ creatorUserId: creator.id, title: 'Camp 1' });
    await campaignRepo.save(campaign);
    await campaignRepo.updateStatus(campaign.id, 'draft', 'submitted', { submittedAt: new Date() });

    const res = await request(app)
      .get('/api/v1/campaigns/review-queue')
      .set('x-test-user-id', 'reviewer_001');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].status).toBe('submitted');
    // Summary view — should NOT have milestones, description, etc. (per spec)
    expect(res.body.data[0].id).toBeDefined();
    expect(res.body.data[0].title).toBeDefined();
  });

  it('returns 403 for non-reviewer', async () => {
    seedUser(userRepo, 'backer_001', { roles: [Role.Backer] });

    const res = await request(app)
      .get('/api/v1/campaigns/review-queue')
      .set('x-test-user-id', 'backer_001');

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('REVIEWER_ROLE_REQUIRED');
  });

  it('returns empty array when no submitted campaigns — 200', async () => {
    seedUser(userRepo, 'reviewer_001', { roles: [Role.Reviewer, Role.Backer] });

    const res = await request(app)
      .get('/api/v1/campaigns/review-queue')
      .set('x-test-user-id', 'reviewer_001');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});

describe('POST /api/v1/campaigns/:id/claim', () => {
  let app: Application;
  let userRepo: InMemoryUserRepository;
  let campaignRepo: InMemoryCampaignRepository;

  beforeEach(() => {
    ({ app, userRepo, campaignRepo } = createTestApp());
  });

  it('claims a submitted campaign — 200', async () => {
    const creator = seedUser(userRepo, 'creator_001');
    const reviewer = seedUser(userRepo, 'reviewer_001', { roles: [Role.Reviewer, Role.Backer] });
    const campaign = Campaign.create({ creatorUserId: creator.id, title: 'Camp' });
    await campaignRepo.save(campaign);
    await campaignRepo.updateStatus(campaign.id, 'draft', 'submitted', { submittedAt: new Date() });

    const res = await request(app)
      .post(`/api/v1/campaigns/${campaign.id}/claim`)
      .set('x-test-user-id', 'reviewer_001');

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('under_review');
    expect(res.body.data.reviewedByUserId).toBe(reviewer.id);
  });
});

describe('POST /api/v1/campaigns/:id/approve', () => {
  let app: Application;
  let userRepo: InMemoryUserRepository;
  let campaignRepo: InMemoryCampaignRepository;

  beforeEach(() => {
    ({ app, userRepo, campaignRepo } = createTestApp());
  });

  it('approves a campaign under review — 200', async () => {
    const creator = seedUser(userRepo, 'creator_001');
    const reviewer = seedUser(userRepo, 'reviewer_001', { roles: [Role.Reviewer, Role.Backer] });
    const campaign = Campaign.create({ creatorUserId: creator.id, title: 'Camp' });
    await campaignRepo.save(campaign);
    await campaignRepo.updateStatus(campaign.id, 'draft', 'submitted', { submittedAt: new Date() });
    await campaignRepo.updateStatus(campaign.id, 'submitted', 'under_review', {
      reviewedByUserId: reviewer.id,
    });

    const res = await request(app)
      .post(`/api/v1/campaigns/${campaign.id}/approve`)
      .set('x-test-user-id', 'reviewer_001')
      .send({ reviewNotes: 'Excellent mission plan!' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('approved');
    expect(res.body.data.reviewNotes).toBe('Excellent mission plan!');
  });

  it('returns 400 for missing reviewNotes', async () => {
    const creator = seedUser(userRepo, 'creator_001');
    const reviewer = seedUser(userRepo, 'reviewer_001', { roles: [Role.Reviewer, Role.Backer] });
    const campaign = Campaign.create({ creatorUserId: creator.id, title: 'Camp' });
    await campaignRepo.save(campaign);
    await campaignRepo.updateStatus(campaign.id, 'draft', 'submitted', { submittedAt: new Date() });
    await campaignRepo.updateStatus(campaign.id, 'submitted', 'under_review', {
      reviewedByUserId: reviewer.id,
    });

    const res = await request(app)
      .post(`/api/v1/campaigns/${campaign.id}/approve`)
      .set('x-test-user-id', 'reviewer_001')
      .send({});

    expect(res.status).toBe(400);
  });
});

describe('POST /api/v1/campaigns/:id/reject', () => {
  let app: Application;
  let userRepo: InMemoryUserRepository;
  let campaignRepo: InMemoryCampaignRepository;

  beforeEach(() => {
    ({ app, userRepo, campaignRepo } = createTestApp());
  });

  it('rejects a campaign under review — 200', async () => {
    const creator = seedUser(userRepo, 'creator_001');
    const reviewer = seedUser(userRepo, 'reviewer_001', { roles: [Role.Reviewer, Role.Backer] });
    const campaign = Campaign.create({ creatorUserId: creator.id, title: 'Camp' });
    await campaignRepo.save(campaign);
    await campaignRepo.updateStatus(campaign.id, 'draft', 'submitted', { submittedAt: new Date() });
    await campaignRepo.updateStatus(campaign.id, 'submitted', 'under_review', {
      reviewedByUserId: reviewer.id,
    });

    const res = await request(app)
      .post(`/api/v1/campaigns/${campaign.id}/reject`)
      .set('x-test-user-id', 'reviewer_001')
      .send({
        rejectionReason: 'Insufficient technical detail',
        resubmissionGuidance: 'Please add detailed risk analysis',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('rejected');
    expect(res.body.data.rejectionReason).toBe('Insufficient technical detail');
    expect(res.body.data.resubmissionGuidance).toBe('Please add detailed risk analysis');
  });
});

describe('POST /api/v1/campaigns/:id/launch', () => {
  let app: Application;
  let userRepo: InMemoryUserRepository;
  let campaignRepo: InMemoryCampaignRepository;

  beforeEach(() => {
    ({ app, userRepo, campaignRepo } = createTestApp());
  });

  it('launches an approved campaign — 200', async () => {
    const user = seedUser(userRepo, 'creator_001');
    const campaign = Campaign.create({ creatorUserId: user.id, title: 'Camp' });
    await campaignRepo.save(campaign);
    await campaignRepo.updateStatus(campaign.id, 'draft', 'submitted', { submittedAt: new Date() });
    await campaignRepo.updateStatus(campaign.id, 'submitted', 'under_review', {
      reviewedByUserId: user.id,
    });
    await campaignRepo.updateStatus(campaign.id, 'under_review', 'approved', {
      reviewNotes: 'OK',
      reviewedAt: new Date(),
    });

    const res = await request(app)
      .post(`/api/v1/campaigns/${campaign.id}/launch`)
      .set('x-test-user-id', 'creator_001');

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('live');
    expect(res.body.data.launchedAt).toBeDefined();
  });

  it('returns 409 for non-approved campaign', async () => {
    const user = seedUser(userRepo, 'creator_001');
    const campaign = Campaign.create({ creatorUserId: user.id, title: 'Camp' });
    await campaignRepo.save(campaign);

    const res = await request(app)
      .post(`/api/v1/campaigns/${campaign.id}/launch`)
      .set('x-test-user-id', 'creator_001');

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CAMPAIGN_NOT_LAUNCHABLE');
  });
});

describe('POST /api/v1/campaigns/:id/archive', () => {
  let app: Application;
  let userRepo: InMemoryUserRepository;
  let campaignRepo: InMemoryCampaignRepository;

  beforeEach(() => {
    ({ app, userRepo, campaignRepo } = createTestApp());
  });

  it('archives a draft campaign — 200', async () => {
    const user = seedUser(userRepo, 'creator_001');
    const campaign = Campaign.create({ creatorUserId: user.id, title: 'Camp' });
    await campaignRepo.save(campaign);

    const res = await request(app)
      .post(`/api/v1/campaigns/${campaign.id}/archive`)
      .set('x-test-user-id', 'creator_001');

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('archived');
  });

  it('returns 409 for creator archiving submitted campaign', async () => {
    const user = seedUser(userRepo, 'creator_001');
    const campaign = Campaign.create({ creatorUserId: user.id, title: 'Camp' });
    await campaignRepo.save(campaign);
    await campaignRepo.updateStatus(campaign.id, 'draft', 'submitted', { submittedAt: new Date() });

    const res = await request(app)
      .post(`/api/v1/campaigns/${campaign.id}/archive`)
      .set('x-test-user-id', 'creator_001');

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CAMPAIGN_CANNOT_ARCHIVE');
  });
});

describe('POST /api/v1/campaigns/:id/reassign', () => {
  let app: Application;
  let userRepo: InMemoryUserRepository;
  let campaignRepo: InMemoryCampaignRepository;

  beforeEach(() => {
    ({ app, userRepo, campaignRepo } = createTestApp());
  });

  it('reassigns reviewer — 200', async () => {
    const creator = seedUser(userRepo, 'creator_001');
    const reviewer1 = seedUser(userRepo, 'reviewer_001', { roles: [Role.Reviewer, Role.Backer] });
    const reviewer2 = seedUser(userRepo, 'reviewer_002', { roles: [Role.Reviewer, Role.Backer] });
    seedUser(userRepo, 'admin_001', { roles: [Role.Administrator, Role.Backer] });

    const campaign = Campaign.create({ creatorUserId: creator.id, title: 'Camp' });
    await campaignRepo.save(campaign);
    await campaignRepo.updateStatus(campaign.id, 'draft', 'submitted', { submittedAt: new Date() });
    await campaignRepo.updateStatus(campaign.id, 'submitted', 'under_review', {
      reviewedByUserId: reviewer1.id,
    });

    const res = await request(app)
      .post(`/api/v1/campaigns/${campaign.id}/reassign`)
      .set('x-test-user-id', 'admin_001')
      .send({ reviewerUserId: reviewer2.id });

    expect(res.status).toBe(200);
    expect(res.body.data.reviewedByUserId).toBe(reviewer2.id);
  });

  it('returns 403 for non-admin', async () => {
    const creator = seedUser(userRepo, 'creator_001');
    const reviewer1 = seedUser(userRepo, 'reviewer_001', { roles: [Role.Reviewer, Role.Backer] });
    const reviewer2 = seedUser(userRepo, 'reviewer_002', { roles: [Role.Reviewer, Role.Backer] });

    const campaign = Campaign.create({ creatorUserId: creator.id, title: 'Camp' });
    await campaignRepo.save(campaign);
    await campaignRepo.updateStatus(campaign.id, 'draft', 'submitted', { submittedAt: new Date() });
    await campaignRepo.updateStatus(campaign.id, 'submitted', 'under_review', {
      reviewedByUserId: reviewer1.id,
    });

    const res = await request(app)
      .post(`/api/v1/campaigns/${campaign.id}/reassign`)
      .set('x-test-user-id', 'reviewer_001')
      .send({ reviewerUserId: reviewer2.id });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ADMIN_ROLE_REQUIRED');
  });
});
