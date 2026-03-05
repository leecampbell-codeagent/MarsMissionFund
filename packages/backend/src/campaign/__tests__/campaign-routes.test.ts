import type express from 'express';
import type { Request as ExpressRequest } from 'express';
import pino from 'pino';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryAccountRepository } from '../../account/adapters/mock/in-memory-account-repository.js';
import { MockAuthAdapter } from '../../account/adapters/mock/mock-auth-adapter.js';
import { MockWebhookVerificationAdapter } from '../../account/adapters/mock/mock-webhook-verification-adapter.js';
import { AccountAppService } from '../../account/application/account-app-service.js';
import {
  Account,
  DEFAULT_NOTIFICATION_PREFERENCES,
} from '../../account/domain/account.js';
import { type AppDependencies, createApp } from '../../app.js';
import { InMemoryCampaignRepository } from '../adapters/mock/in-memory-campaign-repository.js';
import { MockKycStatusAdapter } from '../adapters/mock/mock-kyc-status-adapter.js';
import { CampaignAppService } from '../application/campaign-app-service.js';
import { Campaign } from '../domain/campaign.js';
import { Milestone } from '../domain/milestone.js';
import { InMemoryEventStore } from '../../shared/adapters/mock/in-memory-event-store.js';
import type { AuthClaimsExtractor } from '../../shared/middleware/enrich-auth-context.js';
import type { AuthExtractor } from '../../shared/middleware/require-authentication.js';

const testLogger = pino({ level: 'silent' });

interface MockAuth {
  userId?: string;
  sessionClaims?: { email?: string };
}

function getAuthFromReq(req: ExpressRequest): MockAuth | undefined {
  return (req as unknown as Record<string, unknown>).auth as MockAuth | undefined;
}

function createMockExtractor(): AuthExtractor & AuthClaimsExtractor {
  return {
    getUserId(req: ExpressRequest): string | null {
      const auth = getAuthFromReq(req);
      return auth?.userId ?? null;
    },
    getEmail(req: ExpressRequest): string {
      const auth = getAuthFromReq(req);
      return auth?.sessionClaims?.email ?? 'test@example.com';
    },
    getDisplayName(_req: ExpressRequest): string | null {
      return null;
    },
  };
}

function makeAccount(
  id: string,
  roles: string[] = ['backer', 'creator'],
  clerkUserId = 'user_mock_001',
) {
  return Account.reconstitute({
    id,
    clerkUserId,
    email: `${id}@example.com`,
    displayName: 'Test Creator',
    bio: null,
    avatarUrl: null,
    status: 'active',
    roles: roles as Account['roles'],
    onboardingCompleted: true,
    onboardingStep: 'completed',
    notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES,
    createdAt: new Date('2026-03-01T00:00:00Z'),
    updatedAt: new Date('2026-03-01T00:00:00Z'),
  });
}

function createTestDeps(
  accountRepo: InMemoryAccountRepository,
  campaignRepo: InMemoryCampaignRepository,
  kycStatusAdapter: MockKycStatusAdapter,
  eventStore: InMemoryEventStore,
): AppDependencies {
  const extractor = createMockExtractor();
  return {
    authPort: new MockAuthAdapter(),
    webhookVerifier: new MockWebhookVerificationAdapter(),
    accountAppService: new AccountAppService(accountRepo, eventStore, testLogger),
    campaignAppService: new CampaignAppService(campaignRepo, kycStatusAdapter, eventStore, testLogger),
    authExtractor: extractor,
    claimsExtractor: extractor,
  };
}

function createUnauthDeps(
  accountRepo: InMemoryAccountRepository,
  campaignRepo: InMemoryCampaignRepository,
  kycStatusAdapter: MockKycStatusAdapter,
  eventStore: InMemoryEventStore,
): AppDependencies {
  const extractor = createMockExtractor();
  const noopAuthPort = {
    verifyToken: (_token: string) => Promise.resolve(null),
    getMiddleware:
      () =>
      (
        _req: ExpressRequest,
        _res: import('express').Response,
        next: import('express').NextFunction,
      ) => { next(); },
  };
  return {
    authPort: noopAuthPort,
    webhookVerifier: new MockWebhookVerificationAdapter(),
    accountAppService: new AccountAppService(accountRepo, eventStore, testLogger),
    campaignAppService: new CampaignAppService(campaignRepo, kycStatusAdapter, eventStore, testLogger),
    authExtractor: extractor,
    claimsExtractor: extractor,
  };
}

const VALID_CREATE_BODY = {
  title: 'Next-Gen Ion Drive',
  category: 'propulsion',
  min_funding_target_cents: '150000000',
  max_funding_cap_cents: '500000000',
  summary: 'Revolutionary ion propulsion technology.',
  description: 'Full description here.',
};

const FUTURE_DATE = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

// ─── POST /api/v1/campaigns ───────────────────────────────────────────────────

describe('POST /api/v1/campaigns', () => {
  let accountRepo: InMemoryAccountRepository;
  let campaignRepo: InMemoryCampaignRepository;
  let kycStatusAdapter: MockKycStatusAdapter;
  let eventStore: InMemoryEventStore;
  let app: express.Express;
  let creatorAccount: Account;

  beforeEach(() => {
    accountRepo = new InMemoryAccountRepository();
    campaignRepo = new InMemoryCampaignRepository();
    kycStatusAdapter = new MockKycStatusAdapter();
    eventStore = new InMemoryEventStore();

    creatorAccount = makeAccount('creator-001', ['backer', 'creator']);
    accountRepo.seed(creatorAccount);

    app = createApp(createTestDeps(accountRepo, campaignRepo, kycStatusAdapter, eventStore));
  });

  it('returns 401 without auth', async () => {
    const unauthApp = createApp(createUnauthDeps(accountRepo, campaignRepo, kycStatusAdapter, eventStore));
    const res = await request(unauthApp).post('/api/v1/campaigns').send(VALID_CREATE_BODY);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('returns 403 when user does not have creator role', async () => {
    const backerRepo = new InMemoryAccountRepository();
    const backerAccount = makeAccount('backer-001', ['backer']);
    backerRepo.seed(backerAccount);
    const backerApp = createApp(createTestDeps(backerRepo, campaignRepo, kycStatusAdapter, eventStore));

    const res = await request(backerApp).post('/api/v1/campaigns').send(VALID_CREATE_BODY);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('INSUFFICIENT_ROLE');
  });

  it('creates a draft campaign and returns 201', async () => {
    const res = await request(app).post('/api/v1/campaigns').send(VALID_CREATE_BODY);
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('draft');
    expect(res.body.data.title).toBe('Next-Gen Ion Drive');
    expect(res.body.data.min_funding_target_cents).toBe('150000000');
    expect(res.body.data.max_funding_cap_cents).toBe('500000000');
    expect(res.body.data.creator_id).toBe(creatorAccount.id);
    expect(res.body.data.id).toBeTruthy();
  });

  it('returns 400 for missing required fields', async () => {
    const res = await request(app).post('/api/v1/campaigns').send({ title: 'Only title' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 for invalid category', async () => {
    const res = await request(app)
      .post('/api/v1/campaigns')
      .send({ ...VALID_CREATE_BODY, category: 'invalid_cat' });
    expect(res.status).toBe(400);
  });

  it('accepts optional milestones', async () => {
    const res = await request(app)
      .post('/api/v1/campaigns')
      .send({
        ...VALID_CREATE_BODY,
        milestones: [
          { title: 'Phase 1', target_date: FUTURE_DATE, funding_percentage: 50 },
          { title: 'Phase 2', target_date: FUTURE_DATE, funding_percentage: 50 },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.data.milestones).toHaveLength(2);
  });

  it('monetary amounts are serialised as strings', async () => {
    const res = await request(app).post('/api/v1/campaigns').send(VALID_CREATE_BODY);
    expect(typeof res.body.data.min_funding_target_cents).toBe('string');
    expect(typeof res.body.data.max_funding_cap_cents).toBe('string');
  });
});

// ─── GET /api/v1/campaigns/mine ───────────────────────────────────────────────

describe('GET /api/v1/campaigns/mine', () => {
  let accountRepo: InMemoryAccountRepository;
  let campaignRepo: InMemoryCampaignRepository;
  let kycStatusAdapter: MockKycStatusAdapter;
  let eventStore: InMemoryEventStore;
  let app: express.Express;
  let creatorAccount: Account;

  beforeEach(() => {
    accountRepo = new InMemoryAccountRepository();
    campaignRepo = new InMemoryCampaignRepository();
    kycStatusAdapter = new MockKycStatusAdapter();
    eventStore = new InMemoryEventStore();

    creatorAccount = makeAccount('creator-001', ['backer', 'creator']);
    accountRepo.seed(creatorAccount);

    app = createApp(createTestDeps(accountRepo, campaignRepo, kycStatusAdapter, eventStore));
  });

  it('returns 401 without auth', async () => {
    const unauthApp = createApp(createUnauthDeps(accountRepo, campaignRepo, kycStatusAdapter, eventStore));
    const res = await request(unauthApp).get('/api/v1/campaigns/mine');
    expect(res.status).toBe(401);
  });

  it('returns empty array when creator has no campaigns', async () => {
    const res = await request(app).get('/api/v1/campaigns/mine');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('returns campaigns belonging to the authenticated user', async () => {
    const campaign = Campaign.reconstitute({
      id: 'camp-001',
      creatorId: creatorAccount.id,
      title: 'My Campaign',
      summary: null,
      description: null,
      marsAlignmentStatement: null,
      category: 'propulsion',
      status: 'draft',
      minFundingTargetCents: 150_000_000,
      maxFundingCapCents: 500_000_000,
      deadline: null,
      budgetBreakdown: null,
      teamInfo: null,
      riskDisclosures: null,
      heroImageUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    campaignRepo.seed(campaign);

    const res = await request(app).get('/api/v1/campaigns/mine');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe('camp-001');
  });

  it('does not return campaigns owned by other users', async () => {
    const otherCampaign = Campaign.reconstitute({
      id: 'camp-other',
      creatorId: 'other-creator-id',
      title: 'Other Creator Campaign',
      summary: null,
      description: null,
      marsAlignmentStatement: null,
      category: 'propulsion',
      status: 'draft',
      minFundingTargetCents: 150_000_000,
      maxFundingCapCents: 500_000_000,
      deadline: null,
      budgetBreakdown: null,
      teamInfo: null,
      riskDisclosures: null,
      heroImageUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    campaignRepo.seed(otherCampaign);

    const res = await request(app).get('/api/v1/campaigns/mine');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });
});

// ─── GET /api/v1/campaigns/:id ────────────────────────────────────────────────

describe('GET /api/v1/campaigns/:id', () => {
  let accountRepo: InMemoryAccountRepository;
  let campaignRepo: InMemoryCampaignRepository;
  let kycStatusAdapter: MockKycStatusAdapter;
  let eventStore: InMemoryEventStore;
  let app: express.Express;
  let creatorAccount: Account;
  let campaign: Campaign;

  beforeEach(() => {
    accountRepo = new InMemoryAccountRepository();
    campaignRepo = new InMemoryCampaignRepository();
    kycStatusAdapter = new MockKycStatusAdapter();
    eventStore = new InMemoryEventStore();

    creatorAccount = makeAccount('creator-001', ['backer', 'creator']);
    accountRepo.seed(creatorAccount);

    campaign = Campaign.reconstitute({
      id: 'camp-001',
      creatorId: creatorAccount.id,
      title: 'My Campaign',
      summary: null,
      description: null,
      marsAlignmentStatement: null,
      category: 'propulsion',
      status: 'draft',
      minFundingTargetCents: 150_000_000,
      maxFundingCapCents: 500_000_000,
      deadline: null,
      budgetBreakdown: null,
      teamInfo: null,
      riskDisclosures: null,
      heroImageUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    campaignRepo.seed(campaign);

    app = createApp(createTestDeps(accountRepo, campaignRepo, kycStatusAdapter, eventStore));
  });

  it('returns 401 without auth', async () => {
    const unauthApp = createApp(createUnauthDeps(accountRepo, campaignRepo, kycStatusAdapter, eventStore));
    const res = await request(unauthApp).get(`/api/v1/campaigns/${campaign.id}`);
    expect(res.status).toBe(401);
  });

  it('returns campaign for owner', async () => {
    const res = await request(app).get(`/api/v1/campaigns/${campaign.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(campaign.id);
  });

  it('returns 404 for non-existent campaign', async () => {
    const res = await request(app).get('/api/v1/campaigns/nonexistent-id');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('CAMPAIGN_NOT_FOUND');
  });

  it('returns 404 when accessing another creator\'s campaign (data isolation)', async () => {
    const otherCampaign = Campaign.reconstitute({
      id: 'camp-other',
      creatorId: 'someone-else',
      title: 'Other Campaign',
      summary: null,
      description: null,
      marsAlignmentStatement: null,
      category: 'propulsion',
      status: 'draft',
      minFundingTargetCents: 150_000_000,
      maxFundingCapCents: 500_000_000,
      deadline: null,
      budgetBreakdown: null,
      teamInfo: null,
      riskDisclosures: null,
      heroImageUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    campaignRepo.seed(otherCampaign);

    const res = await request(app).get(`/api/v1/campaigns/${otherCampaign.id}`);
    expect(res.status).toBe(404);
  });
});

// ─── PATCH /api/v1/campaigns/:id ─────────────────────────────────────────────

describe('PATCH /api/v1/campaigns/:id', () => {
  let accountRepo: InMemoryAccountRepository;
  let campaignRepo: InMemoryCampaignRepository;
  let kycStatusAdapter: MockKycStatusAdapter;
  let eventStore: InMemoryEventStore;
  let app: express.Express;
  let creatorAccount: Account;
  let campaign: Campaign;

  beforeEach(() => {
    accountRepo = new InMemoryAccountRepository();
    campaignRepo = new InMemoryCampaignRepository();
    kycStatusAdapter = new MockKycStatusAdapter();
    eventStore = new InMemoryEventStore();

    creatorAccount = makeAccount('creator-001', ['backer', 'creator']);
    accountRepo.seed(creatorAccount);

    campaign = Campaign.reconstitute({
      id: 'camp-001',
      creatorId: creatorAccount.id,
      title: 'My Campaign',
      summary: null,
      description: null,
      marsAlignmentStatement: null,
      category: 'propulsion',
      status: 'draft',
      minFundingTargetCents: 150_000_000,
      maxFundingCapCents: 500_000_000,
      deadline: null,
      budgetBreakdown: null,
      teamInfo: null,
      riskDisclosures: null,
      heroImageUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    campaignRepo.seed(campaign);

    app = createApp(createTestDeps(accountRepo, campaignRepo, kycStatusAdapter, eventStore));
  });

  it('returns 401 without auth', async () => {
    const unauthApp = createApp(createUnauthDeps(accountRepo, campaignRepo, kycStatusAdapter, eventStore));
    const res = await request(unauthApp)
      .patch(`/api/v1/campaigns/${campaign.id}`)
      .send({ summary: 'Updated summary' });
    expect(res.status).toBe(401);
  });

  it('updates a draft campaign', async () => {
    const res = await request(app)
      .patch(`/api/v1/campaigns/${campaign.id}`)
      .send({ summary: 'Updated summary' });
    expect(res.status).toBe(200);
    expect(res.body.data.summary).toBe('Updated summary');
  });

  it('returns 400 for empty body', async () => {
    const res = await request(app).patch(`/api/v1/campaigns/${campaign.id}`).send({});
    expect(res.status).toBe(400);
  });

  it('returns 404 for non-existent campaign', async () => {
    const res = await request(app)
      .patch('/api/v1/campaigns/nonexistent')
      .send({ summary: 'updated' });
    expect(res.status).toBe(404);
  });

  it('returns 409 for already submitted campaign', async () => {
    const submittedCampaign = Campaign.reconstitute({
      id: 'camp-submitted',
      creatorId: creatorAccount.id,
      title: 'Submitted Campaign',
      summary: 'summary',
      description: 'desc',
      marsAlignmentStatement: 'alignment',
      category: 'propulsion',
      status: 'submitted',
      minFundingTargetCents: 150_000_000,
      maxFundingCapCents: 500_000_000,
      deadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      budgetBreakdown: null,
      teamInfo: JSON.stringify([{ name: 'Jane' }]),
      riskDisclosures: JSON.stringify([{ risk: 'some risk' }]),
      heroImageUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    campaignRepo.seed(submittedCampaign);

    const res = await request(app)
      .patch(`/api/v1/campaigns/${submittedCampaign.id}`)
      .send({ summary: 'trying to update' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CAMPAIGN_ALREADY_SUBMITTED');
  });
});

// ─── POST /api/v1/campaigns/:id/submit ───────────────────────────────────────

describe('POST /api/v1/campaigns/:id/submit', () => {
  let accountRepo: InMemoryAccountRepository;
  let campaignRepo: InMemoryCampaignRepository;
  let kycStatusAdapter: MockKycStatusAdapter;
  let eventStore: InMemoryEventStore;
  let app: express.Express;
  let creatorAccount: Account;

  function makeDraftCampaignForSubmission(creatorId: string): Campaign {
    const c = Campaign.reconstitute({
      id: 'camp-ready',
      creatorId,
      title: 'Ready to Submit',
      summary: 'A great campaign.',
      description: 'Full description here with enough detail.',
      marsAlignmentStatement: 'This will help get us to Mars.',
      category: 'propulsion',
      status: 'draft',
      minFundingTargetCents: 150_000_000,
      maxFundingCapCents: 500_000_000,
      deadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      budgetBreakdown: 'R&D: 60%, Operations: 40%',
      teamInfo: JSON.stringify([{ name: 'Dr. Jane Smith', role: 'Lead Engineer' }]),
      riskDisclosures: JSON.stringify([{ risk: 'Technical failure', mitigation: 'Redundant systems' }]),
      heroImageUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const milestones = [
      Milestone.reconstitute({
        id: 'm-001',
        campaignId: c.id,
        title: 'Phase 1',
        description: 'First phase',
        targetDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
        fundingPercentage: 50,
        verificationCriteria: 'Prototype built',
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      Milestone.reconstitute({
        id: 'm-002',
        campaignId: c.id,
        title: 'Phase 2',
        description: 'Second phase',
        targetDate: new Date(Date.now() + 80 * 24 * 60 * 60 * 1000),
        fundingPercentage: 50,
        verificationCriteria: 'Production ready',
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ];
    campaignRepo.seed(c, milestones);
    return c;
  }

  beforeEach(() => {
    accountRepo = new InMemoryAccountRepository();
    campaignRepo = new InMemoryCampaignRepository();
    kycStatusAdapter = new MockKycStatusAdapter();
    eventStore = new InMemoryEventStore();

    creatorAccount = makeAccount('creator-001', ['backer', 'creator']);
    accountRepo.seed(creatorAccount);

    app = createApp(createTestDeps(accountRepo, campaignRepo, kycStatusAdapter, eventStore));
  });

  it('returns 401 without auth', async () => {
    makeDraftCampaignForSubmission(creatorAccount.id);
    const unauthApp = createApp(createUnauthDeps(accountRepo, campaignRepo, kycStatusAdapter, eventStore));
    const res = await request(unauthApp).post('/api/v1/campaigns/camp-ready/submit');
    expect(res.status).toBe(401);
  });

  it('returns 403 when KYC not verified', async () => {
    kycStatusAdapter.setDefaultStatus('not_verified');
    makeDraftCampaignForSubmission(creatorAccount.id);

    const res = await request(app).post('/api/v1/campaigns/camp-ready/submit');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('KYC_REQUIRED');
  });

  it('submits a campaign and returns 200 with submitted status', async () => {
    kycStatusAdapter.setDefaultStatus('verified');
    makeDraftCampaignForSubmission(creatorAccount.id);

    const res = await request(app).post('/api/v1/campaigns/camp-ready/submit');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('submitted');
  });

  it('returns 404 for non-existent campaign', async () => {
    const res = await request(app).post('/api/v1/campaigns/nonexistent/submit');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('CAMPAIGN_NOT_FOUND');
  });

  it('returns 409 for already submitted campaign', async () => {
    const submittedCampaign = Campaign.reconstitute({
      id: 'camp-submitted-2',
      creatorId: creatorAccount.id,
      title: 'Already Submitted',
      summary: 'summary',
      description: 'desc',
      marsAlignmentStatement: 'alignment',
      category: 'propulsion',
      status: 'submitted',
      minFundingTargetCents: 150_000_000,
      maxFundingCapCents: 500_000_000,
      deadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      budgetBreakdown: null,
      teamInfo: JSON.stringify([{ name: 'Jane' }]),
      riskDisclosures: JSON.stringify([{ risk: 'some risk' }]),
      heroImageUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    campaignRepo.seed(submittedCampaign);

    const res = await request(app).post(`/api/v1/campaigns/${submittedCampaign.id}/submit`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CAMPAIGN_ALREADY_SUBMITTED');
  });

  it('returns 400 when campaign missing required fields for submission', async () => {
    const incompleteCampaign = Campaign.reconstitute({
      id: 'camp-incomplete',
      creatorId: creatorAccount.id,
      title: 'Incomplete Campaign',
      summary: null, // missing summary
      description: null,
      marsAlignmentStatement: null,
      category: 'propulsion',
      status: 'draft',
      minFundingTargetCents: 150_000_000,
      maxFundingCapCents: 500_000_000,
      deadline: null,
      budgetBreakdown: null,
      teamInfo: null,
      riskDisclosures: null,
      heroImageUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    campaignRepo.seed(incompleteCampaign);

    const res = await request(app).post(`/api/v1/campaigns/${incompleteCampaign.id}/submit`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_CAMPAIGN_DATA');
  });
});
