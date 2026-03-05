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
  roles: string[] = ['backer', 'reviewer'],
  clerkUserId = 'user_mock_001',
) {
  return Account.reconstitute({
    id,
    clerkUserId,
    email: `${id}@example.com`,
    displayName: 'Test Reviewer',
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

function makeSubmittedCampaign(id: string, creatorId: string): Campaign {
  return Campaign.reconstitute({
    id,
    creatorId,
    title: 'Ion Drive Prototype',
    summary: 'Revolutionary ion propulsion.',
    description: 'Full description of the project.',
    marsAlignmentStatement: 'Cuts transit time by 40%.',
    category: 'propulsion',
    status: 'submitted',
    minFundingTargetCents: 150_000_000,
    maxFundingCapCents: 500_000_000,
    deadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    budgetBreakdown: 'R&D: 60%',
    teamInfo: JSON.stringify([{ name: 'Dr. Jane Smith', role: 'Lead Engineer' }]),
    riskDisclosures: JSON.stringify([{ risk: 'Technical failure', mitigation: 'Redundancy' }]),
    heroImageUrl: null,
    reviewerId: null,
    reviewerComment: null,
    reviewedAt: null,
    createdAt: new Date('2026-03-01T00:00:00Z'),
    updatedAt: new Date('2026-03-01T00:00:00Z'),
  });
}

function makeUnderReviewCampaign(id: string, creatorId: string, reviewerId: string): Campaign {
  return Campaign.reconstitute({
    id,
    creatorId,
    title: 'Ion Drive Prototype',
    summary: 'Revolutionary ion propulsion.',
    description: 'Full description of the project.',
    marsAlignmentStatement: 'Cuts transit time by 40%.',
    category: 'propulsion',
    status: 'under_review',
    minFundingTargetCents: 150_000_000,
    maxFundingCapCents: 500_000_000,
    deadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    budgetBreakdown: 'R&D: 60%',
    teamInfo: JSON.stringify([{ name: 'Dr. Jane Smith', role: 'Lead Engineer' }]),
    riskDisclosures: JSON.stringify([{ risk: 'Technical failure', mitigation: 'Redundancy' }]),
    heroImageUrl: null,
    reviewerId,
    reviewerComment: null,
    reviewedAt: new Date('2026-03-02T00:00:00Z'),
    createdAt: new Date('2026-03-01T00:00:00Z'),
    updatedAt: new Date('2026-03-02T00:00:00Z'),
  });
}

function seedWithMilestones(
  repo: InMemoryCampaignRepository,
  campaign: Campaign,
): void {
  const milestones = [
    Milestone.reconstitute({
      id: `m-${campaign.id}-1`,
      campaignId: campaign.id,
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
      id: `m-${campaign.id}-2`,
      campaignId: campaign.id,
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
  repo.seed(campaign, milestones);
}

// ─── GET /api/v1/campaigns/review-queue ───────────────────────────────────────

describe('GET /api/v1/campaigns/review-queue', () => {
  let accountRepo: InMemoryAccountRepository;
  let campaignRepo: InMemoryCampaignRepository;
  let kycStatusAdapter: MockKycStatusAdapter;
  let eventStore: InMemoryEventStore;
  let reviewerAccount: Account;
  let creatorAccount: Account;
  let app: express.Express;

  beforeEach(() => {
    accountRepo = new InMemoryAccountRepository();
    campaignRepo = new InMemoryCampaignRepository();
    kycStatusAdapter = new MockKycStatusAdapter();
    eventStore = new InMemoryEventStore();

    reviewerAccount = makeAccount('reviewer-001', ['backer', 'reviewer']);
    creatorAccount = makeAccount('creator-001', ['backer', 'creator']);
    accountRepo.seed(reviewerAccount);
    accountRepo.seed(creatorAccount);

    app = createApp(createTestDeps(accountRepo, campaignRepo, kycStatusAdapter, eventStore));
  });

  it('returns 401 without auth', async () => {
    const unauthApp = createApp(createUnauthDeps(accountRepo, campaignRepo, kycStatusAdapter, eventStore));
    const res = await request(unauthApp).get('/api/v1/campaigns/review-queue');
    expect(res.status).toBe(401);
  });

  it('returns 403 for backer role', async () => {
    const backerRepo = new InMemoryAccountRepository();
    const backerAccount = makeAccount('backer-001', ['backer']);
    backerRepo.seed(backerAccount);
    const backerApp = createApp(createTestDeps(backerRepo, campaignRepo, kycStatusAdapter, eventStore));

    const res = await request(backerApp).get('/api/v1/campaigns/review-queue');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('INSUFFICIENT_ROLE');
  });

  it('returns empty array when no submitted campaigns', async () => {
    const res = await request(app).get('/api/v1/campaigns/review-queue');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('returns submitted and under_review campaigns in FIFO order', async () => {
    const c1 = makeSubmittedCampaign('camp-001', creatorAccount.id);
    const c2 = makeSubmittedCampaign('camp-002', creatorAccount.id);
    const c3 = makeUnderReviewCampaign('camp-003', creatorAccount.id, reviewerAccount.id);
    // c1 and c2 submitted, c3 under review — all should appear
    seedWithMilestones(campaignRepo, c1);
    seedWithMilestones(campaignRepo, c2);
    seedWithMilestones(campaignRepo, c3);

    const res = await request(app).get('/api/v1/campaigns/review-queue');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3);
    // FIFO: c1 created first (all same date here), but all 3 appear
    const statuses = res.body.data.map((c: { status: string }) => c.status);
    expect(statuses).toContain('submitted');
    expect(statuses).toContain('under_review');
  });

  it('does not return draft or approved campaigns', async () => {
    const draftCampaign = Campaign.reconstitute({
      id: 'camp-draft',
      creatorId: creatorAccount.id,
      title: 'Draft',
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
    campaignRepo.seed(draftCampaign);

    const res = await request(app).get('/api/v1/campaigns/review-queue');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  it('allows administrator role to access review queue', async () => {
    const adminRepo = new InMemoryAccountRepository();
    const adminAccount = makeAccount('admin-001', ['backer', 'administrator']);
    adminRepo.seed(adminAccount);
    const adminApp = createApp(createTestDeps(adminRepo, campaignRepo, kycStatusAdapter, eventStore));

    const res = await request(adminApp).get('/api/v1/campaigns/review-queue');
    expect(res.status).toBe(200);
  });
});

// ─── POST /api/v1/campaigns/:id/claim ────────────────────────────────────────

describe('POST /api/v1/campaigns/:id/claim', () => {
  let accountRepo: InMemoryAccountRepository;
  let campaignRepo: InMemoryCampaignRepository;
  let kycStatusAdapter: MockKycStatusAdapter;
  let eventStore: InMemoryEventStore;
  let reviewerAccount: Account;
  let creatorAccount: Account;
  let app: express.Express;
  let submittedCampaign: Campaign;

  beforeEach(() => {
    accountRepo = new InMemoryAccountRepository();
    campaignRepo = new InMemoryCampaignRepository();
    kycStatusAdapter = new MockKycStatusAdapter();
    eventStore = new InMemoryEventStore();

    reviewerAccount = makeAccount('reviewer-001', ['backer', 'reviewer']);
    creatorAccount = makeAccount('creator-001', ['backer', 'creator']);
    accountRepo.seed(reviewerAccount);
    accountRepo.seed(creatorAccount);

    submittedCampaign = makeSubmittedCampaign('camp-submitted', creatorAccount.id);
    seedWithMilestones(campaignRepo, submittedCampaign);

    app = createApp(createTestDeps(accountRepo, campaignRepo, kycStatusAdapter, eventStore));
  });

  it('returns 401 without auth', async () => {
    const unauthApp = createApp(createUnauthDeps(accountRepo, campaignRepo, kycStatusAdapter, eventStore));
    const res = await request(unauthApp).post(`/api/v1/campaigns/${submittedCampaign.id}/claim`);
    expect(res.status).toBe(401);
  });

  it('returns 403 for backer role', async () => {
    const backerRepo = new InMemoryAccountRepository();
    const backerAccount = makeAccount('backer-001', ['backer']);
    backerRepo.seed(backerAccount);
    const backerApp = createApp(createTestDeps(backerRepo, campaignRepo, kycStatusAdapter, eventStore));

    const res = await request(backerApp).post(`/api/v1/campaigns/${submittedCampaign.id}/claim`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('INSUFFICIENT_ROLE');
  });

  it('claims a submitted campaign and transitions to under_review', async () => {
    const res = await request(app).post(`/api/v1/campaigns/${submittedCampaign.id}/claim`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('under_review');
    expect(res.body.data.reviewer_id).toBe(reviewerAccount.id);
    expect(res.body.data.reviewed_at).toBeTruthy();
  });

  it('returns 404 for non-existent campaign', async () => {
    const res = await request(app).post('/api/v1/campaigns/nonexistent/claim');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('CAMPAIGN_NOT_FOUND');
  });

  it('returns 409 when claiming an already under_review campaign', async () => {
    const underReviewCampaign = makeUnderReviewCampaign('camp-ur', creatorAccount.id, reviewerAccount.id);
    seedWithMilestones(campaignRepo, underReviewCampaign);

    const res = await request(app).post(`/api/v1/campaigns/${underReviewCampaign.id}/claim`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CAMPAIGN_NOT_REVIEWABLE');
  });
});

// ─── POST /api/v1/campaigns/:id/approve ──────────────────────────────────────

describe('POST /api/v1/campaigns/:id/approve', () => {
  let accountRepo: InMemoryAccountRepository;
  let campaignRepo: InMemoryCampaignRepository;
  let kycStatusAdapter: MockKycStatusAdapter;
  let eventStore: InMemoryEventStore;
  let reviewerAccount: Account;
  let creatorAccount: Account;
  let app: express.Express;
  let underReviewCampaign: Campaign;

  beforeEach(() => {
    accountRepo = new InMemoryAccountRepository();
    campaignRepo = new InMemoryCampaignRepository();
    kycStatusAdapter = new MockKycStatusAdapter();
    eventStore = new InMemoryEventStore();

    reviewerAccount = makeAccount('reviewer-001', ['backer', 'reviewer']);
    creatorAccount = makeAccount('creator-001', ['backer', 'creator']);
    accountRepo.seed(reviewerAccount);
    accountRepo.seed(creatorAccount);

    underReviewCampaign = makeUnderReviewCampaign('camp-ur', creatorAccount.id, reviewerAccount.id);
    seedWithMilestones(campaignRepo, underReviewCampaign);

    app = createApp(createTestDeps(accountRepo, campaignRepo, kycStatusAdapter, eventStore));
  });

  it('returns 401 without auth', async () => {
    const unauthApp = createApp(createUnauthDeps(accountRepo, campaignRepo, kycStatusAdapter, eventStore));
    const res = await request(unauthApp)
      .post(`/api/v1/campaigns/${underReviewCampaign.id}/approve`)
      .send({ comment: 'Great campaign!' });
    expect(res.status).toBe(401);
  });

  it('returns 403 for backer role', async () => {
    const backerRepo = new InMemoryAccountRepository();
    const backerAccount = makeAccount('backer-001', ['backer']);
    backerRepo.seed(backerAccount);
    const backerApp = createApp(createTestDeps(backerRepo, campaignRepo, kycStatusAdapter, eventStore));

    const res = await request(backerApp)
      .post(`/api/v1/campaigns/${underReviewCampaign.id}/approve`)
      .send({ comment: 'Great campaign!' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('INSUFFICIENT_ROLE');
  });

  it('approves a campaign under review with comment', async () => {
    const res = await request(app)
      .post(`/api/v1/campaigns/${underReviewCampaign.id}/approve`)
      .send({ comment: 'Excellent Mars alignment and feasible plan.' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('approved');
    expect(res.body.data.reviewer_comment).toBe('Excellent Mars alignment and feasible plan.');
  });

  it('returns 400 for missing comment', async () => {
    const res = await request(app)
      .post(`/api/v1/campaigns/${underReviewCampaign.id}/approve`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('returns 400 for empty comment', async () => {
    const res = await request(app)
      .post(`/api/v1/campaigns/${underReviewCampaign.id}/approve`)
      .send({ comment: '   ' });
    expect(res.status).toBe(400);
  });

  it('returns 409 when wrong reviewer tries to approve', async () => {
    // Campaign is assigned to 'some-other-reviewer-id', not reviewerAccount.id ('reviewer-001')
    const campaignAssignedElsewhere = makeUnderReviewCampaign(
      'camp-assigned-elsewhere',
      creatorAccount.id,
      'some-other-reviewer-id',
    );
    seedWithMilestones(campaignRepo, campaignAssignedElsewhere);

    const res = await request(app)
      .post(`/api/v1/campaigns/${campaignAssignedElsewhere.id}/approve`)
      .send({ comment: 'Looks good!' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CAMPAIGN_NOT_REVIEWABLE');
  });

  it('returns 409 when approving a submitted (not under_review) campaign', async () => {
    const submittedCampaign = makeSubmittedCampaign('camp-sub', creatorAccount.id);
    seedWithMilestones(campaignRepo, submittedCampaign);

    const res = await request(app)
      .post(`/api/v1/campaigns/${submittedCampaign.id}/approve`)
      .send({ comment: 'Great campaign!' });
    expect(res.status).toBe(409);
  });

  it('returns 404 for non-existent campaign', async () => {
    const res = await request(app)
      .post('/api/v1/campaigns/nonexistent/approve')
      .send({ comment: 'Great!' });
    expect(res.status).toBe(404);
  });

  it('emits an audit event on approval', async () => {
    await request(app)
      .post(`/api/v1/campaigns/${underReviewCampaign.id}/approve`)
      .send({ comment: 'Great Mars alignment.' });

    const events = eventStore.getAllEvents();
    const approvalEvent = events.find((e) => e.eventType === 'campaign.approved');
    expect(approvalEvent).toBeDefined();
    expect(approvalEvent?.payload.campaignId).toBe(underReviewCampaign.id);
    expect(approvalEvent?.payload.reviewerId).toBe(reviewerAccount.id);
  });
});

// ─── POST /api/v1/campaigns/:id/reject ───────────────────────────────────────

describe('POST /api/v1/campaigns/:id/reject', () => {
  let accountRepo: InMemoryAccountRepository;
  let campaignRepo: InMemoryCampaignRepository;
  let kycStatusAdapter: MockKycStatusAdapter;
  let eventStore: InMemoryEventStore;
  let reviewerAccount: Account;
  let creatorAccount: Account;
  let app: express.Express;
  let underReviewCampaign: Campaign;

  beforeEach(() => {
    accountRepo = new InMemoryAccountRepository();
    campaignRepo = new InMemoryCampaignRepository();
    kycStatusAdapter = new MockKycStatusAdapter();
    eventStore = new InMemoryEventStore();

    reviewerAccount = makeAccount('reviewer-001', ['backer', 'reviewer']);
    creatorAccount = makeAccount('creator-001', ['backer', 'creator']);
    accountRepo.seed(reviewerAccount);
    accountRepo.seed(creatorAccount);

    underReviewCampaign = makeUnderReviewCampaign('camp-ur', creatorAccount.id, reviewerAccount.id);
    seedWithMilestones(campaignRepo, underReviewCampaign);

    app = createApp(createTestDeps(accountRepo, campaignRepo, kycStatusAdapter, eventStore));
  });

  it('rejects a campaign with a comment', async () => {
    const res = await request(app)
      .post(`/api/v1/campaigns/${underReviewCampaign.id}/reject`)
      .send({ comment: 'Missing team credentials. Please add bios and relevant experience.' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('rejected');
    expect(res.body.data.reviewer_comment).toBe(
      'Missing team credentials. Please add bios and relevant experience.',
    );
  });

  it('returns 400 for missing comment', async () => {
    const res = await request(app)
      .post(`/api/v1/campaigns/${underReviewCampaign.id}/reject`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('returns 403 for backer role', async () => {
    const backerRepo = new InMemoryAccountRepository();
    const backerAccount = makeAccount('backer-001', ['backer']);
    backerRepo.seed(backerAccount);
    const backerApp = createApp(createTestDeps(backerRepo, campaignRepo, kycStatusAdapter, eventStore));

    const res = await request(backerApp)
      .post(`/api/v1/campaigns/${underReviewCampaign.id}/reject`)
      .send({ comment: 'Not good.' });
    expect(res.status).toBe(403);
  });

  it('returns 409 when wrong reviewer tries to reject', async () => {
    // Campaign assigned to a different reviewer ID, not the logged-in reviewer
    const campaignAssignedElsewhere = makeUnderReviewCampaign(
      'camp-assigned-elsewhere-reject',
      creatorAccount.id,
      'some-other-reviewer-id',
    );
    seedWithMilestones(campaignRepo, campaignAssignedElsewhere);

    const res = await request(app)
      .post(`/api/v1/campaigns/${campaignAssignedElsewhere.id}/reject`)
      .send({ comment: 'Not good.' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CAMPAIGN_NOT_REVIEWABLE');
  });

  it('emits an audit event on rejection', async () => {
    await request(app)
      .post(`/api/v1/campaigns/${underReviewCampaign.id}/reject`)
      .send({ comment: 'Missing required fields.' });

    const events = eventStore.getAllEvents();
    const rejectionEvent = events.find((e) => e.eventType === 'campaign.rejected');
    expect(rejectionEvent).toBeDefined();
    expect(rejectionEvent?.payload.campaignId).toBe(underReviewCampaign.id);
  });
});

// ─── POST /api/v1/campaigns/:id/recuse ───────────────────────────────────────

describe('POST /api/v1/campaigns/:id/recuse', () => {
  let accountRepo: InMemoryAccountRepository;
  let campaignRepo: InMemoryCampaignRepository;
  let kycStatusAdapter: MockKycStatusAdapter;
  let eventStore: InMemoryEventStore;
  let reviewerAccount: Account;
  let creatorAccount: Account;
  let app: express.Express;
  let underReviewCampaign: Campaign;

  beforeEach(() => {
    accountRepo = new InMemoryAccountRepository();
    campaignRepo = new InMemoryCampaignRepository();
    kycStatusAdapter = new MockKycStatusAdapter();
    eventStore = new InMemoryEventStore();

    reviewerAccount = makeAccount('reviewer-001', ['backer', 'reviewer']);
    creatorAccount = makeAccount('creator-001', ['backer', 'creator']);
    accountRepo.seed(reviewerAccount);
    accountRepo.seed(creatorAccount);

    underReviewCampaign = makeUnderReviewCampaign('camp-ur', creatorAccount.id, reviewerAccount.id);
    seedWithMilestones(campaignRepo, underReviewCampaign);

    app = createApp(createTestDeps(accountRepo, campaignRepo, kycStatusAdapter, eventStore));
  });

  it('recuses from a campaign and returns to submitted', async () => {
    const res = await request(app).post(`/api/v1/campaigns/${underReviewCampaign.id}/recuse`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('submitted');
    expect(res.body.data.reviewer_id).toBeNull();
  });

  it('returns 403 for backer role', async () => {
    const backerRepo = new InMemoryAccountRepository();
    const backerAccount = makeAccount('backer-001', ['backer']);
    backerRepo.seed(backerAccount);
    const backerApp = createApp(createTestDeps(backerRepo, campaignRepo, kycStatusAdapter, eventStore));

    const res = await request(backerApp).post(`/api/v1/campaigns/${underReviewCampaign.id}/recuse`);
    expect(res.status).toBe(403);
  });

  it('returns 409 when wrong reviewer tries to recuse', async () => {
    // Campaign assigned to a different reviewer ID, not the logged-in reviewer
    const campaignAssignedElsewhere = makeUnderReviewCampaign(
      'camp-assigned-elsewhere-recuse',
      creatorAccount.id,
      'some-other-reviewer-id',
    );
    seedWithMilestones(campaignRepo, campaignAssignedElsewhere);

    const res = await request(app).post(`/api/v1/campaigns/${campaignAssignedElsewhere.id}/recuse`);
    expect(res.status).toBe(409);
  });

  it('returns 401 without auth', async () => {
    const unauthApp = createApp(createUnauthDeps(accountRepo, campaignRepo, kycStatusAdapter, eventStore));
    const res = await request(unauthApp).post(`/api/v1/campaigns/${underReviewCampaign.id}/recuse`);
    expect(res.status).toBe(401);
  });
});

// ─── POST /api/v1/campaigns/:id/return-to-draft ───────────────────────────────

describe('POST /api/v1/campaigns/:id/return-to-draft', () => {
  let accountRepo: InMemoryAccountRepository;
  let campaignRepo: InMemoryCampaignRepository;
  let kycStatusAdapter: MockKycStatusAdapter;
  let eventStore: InMemoryEventStore;
  let creatorAccount: Account;
  let app: express.Express;
  let rejectedCampaign: Campaign;

  beforeEach(() => {
    accountRepo = new InMemoryAccountRepository();
    campaignRepo = new InMemoryCampaignRepository();
    kycStatusAdapter = new MockKycStatusAdapter();
    eventStore = new InMemoryEventStore();

    creatorAccount = makeAccount('creator-001', ['backer', 'creator']);
    accountRepo.seed(creatorAccount);

    rejectedCampaign = Campaign.reconstitute({
      id: 'camp-rejected',
      creatorId: creatorAccount.id,
      title: 'Ion Drive Prototype',
      summary: 'Revolutionary ion propulsion.',
      description: 'Full description.',
      marsAlignmentStatement: 'Cuts transit time by 40%.',
      category: 'propulsion',
      status: 'rejected',
      minFundingTargetCents: 150_000_000,
      maxFundingCapCents: 500_000_000,
      deadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      budgetBreakdown: null,
      teamInfo: JSON.stringify([{ name: 'Dr. Jane Smith' }]),
      riskDisclosures: JSON.stringify([{ risk: 'Technical failure' }]),
      heroImageUrl: null,
      reviewerId: 'reviewer-001',
      reviewerComment: 'Needs more team detail.',
      reviewedAt: new Date(),
      createdAt: new Date('2026-03-01T00:00:00Z'),
      updatedAt: new Date('2026-03-02T00:00:00Z'),
    });
    seedWithMilestones(campaignRepo, rejectedCampaign);

    app = createApp(createTestDeps(accountRepo, campaignRepo, kycStatusAdapter, eventStore));
  });

  it('returns campaign to draft with data preserved', async () => {
    const res = await request(app).post(`/api/v1/campaigns/${rejectedCampaign.id}/return-to-draft`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('draft');
    expect(res.body.data.title).toBe('Ion Drive Prototype');
    expect(res.body.data.summary).toBe('Revolutionary ion propulsion.');
  });

  it('returns 401 without auth', async () => {
    const unauthApp = createApp(createUnauthDeps(accountRepo, campaignRepo, kycStatusAdapter, eventStore));
    const res = await request(unauthApp).post(`/api/v1/campaigns/${rejectedCampaign.id}/return-to-draft`);
    expect(res.status).toBe(401);
  });

  it('returns 404 for non-existent campaign', async () => {
    const res = await request(app).post('/api/v1/campaigns/nonexistent/return-to-draft');
    expect(res.status).toBe(404);
  });

  it('returns 409 when campaign is not rejected', async () => {
    const submittedCampaign = makeSubmittedCampaign('camp-sub', creatorAccount.id);
    seedWithMilestones(campaignRepo, submittedCampaign);

    const res = await request(app).post(`/api/v1/campaigns/${submittedCampaign.id}/return-to-draft`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CAMPAIGN_NOT_REVIEWABLE');
  });

  it('returns 404 when different creator tries to return their campaign to draft', async () => {
    const otherCreatorRepo = new InMemoryAccountRepository();
    const otherCreator = makeAccount('creator-002', ['backer', 'creator'], 'user_mock_003');
    otherCreatorRepo.seed(otherCreator);
    const otherApp = createApp(createTestDeps(otherCreatorRepo, campaignRepo, kycStatusAdapter, eventStore));

    const res = await request(otherApp).post(`/api/v1/campaigns/${rejectedCampaign.id}/return-to-draft`);
    expect(res.status).toBe(404);
  });
});
