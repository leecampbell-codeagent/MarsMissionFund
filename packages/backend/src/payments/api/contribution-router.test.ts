import type { Application } from 'express';
import express from 'express';
import type { Pool, PoolClient } from 'pg';
import pino from 'pino';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryUserRepository } from '../../account/adapters/in-memory-user-repository.adapter.js';
import { User, type UserData } from '../../account/domain/models/user.js';
import { AccountStatus } from '../../account/domain/value-objects/account-status.js';
import { KycStatus } from '../../account/domain/value-objects/kyc-status.js';
import { NotificationPreferences } from '../../account/domain/value-objects/notification-preferences.js';
import { Role } from '../../account/domain/value-objects/role.js';
import { InMemoryCampaignRepository } from '../../campaign/adapters/in-memory-campaign-repository.adapter.js';
import { Campaign, type CampaignData } from '../../campaign/domain/models/campaign.js';
import { correlationIdMiddleware } from '../../shared/middleware/auth.js';
import { createErrorHandler } from '../../shared/middleware/error-handler.js';
import { InMemoryContributionAuditRepository } from '../adapters/in-memory-contribution-audit-repository.adapter.js';
import { InMemoryContributionRepository } from '../adapters/in-memory-contribution-repository.adapter.js';
import { InMemoryEscrowLedgerRepository } from '../adapters/in-memory-escrow-ledger-repository.adapter.js';
import { ContributionAppService } from '../application/contribution-app-service.js';
import type {
  CaptureInput,
  CaptureResult,
  PaymentGatewayPort,
} from '../ports/payment-gateway.port.js';
import { createContributionRouter } from './contribution-router.js';

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

// ─── Stub gateway ─────────────────────────────────────────────────────────────

class StubGateway implements PaymentGatewayPort {
  async capture(input: CaptureInput): Promise<CaptureResult> {
    if (input.paymentToken === 'tok_fail') {
      return {
        success: false,
        transactionRef: null,
        failureReason: 'Your payment method was declined.',
      };
    }
    return {
      success: true,
      transactionRef: `stub_txn_${input.contributionId}`,
      failureReason: null,
    };
  }
}

// ─── Mock pool for transactions ───────────────────────────────────────────────

function makeMockPool(
  campaignRepo: InMemoryCampaignRepository,
  contributionRepo: InMemoryContributionRepository,
): Pool {
  const mockClient: Partial<PoolClient> = {
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      if (sql === 'BEGIN' || sql === 'ROLLBACK' || sql === 'COMMIT') {
        return { rows: [], rowCount: 0 };
      }

      if (typeof sql === 'string' && sql.includes('UPDATE contributions') && params) {
        const typedParams = params as Array<string | null | undefined>;
        const contributionId = typedParams[0] ?? '';
        const status = typedParams[1] ?? 'pending_capture';
        const transactionRef = typedParams[2] ?? null;
        const failureReason = typedParams[3] ?? null;
        const existing = contributionRepo.contributions.get(contributionId);
        if (existing) {
          const { Contribution } = await import('../domain/models/contribution.js');
          const { ContributionStatus } = await import(
            '../domain/value-objects/contribution-status.js'
          );
          const updated = Contribution.reconstitute({
            id: existing.id,
            donorUserId: existing.donorUserId,
            campaignId: existing.campaignId,
            amountCents: existing.amountCents,
            paymentToken: existing.paymentToken,
            status: status as (typeof ContributionStatus)[keyof typeof ContributionStatus],
            transactionRef: transactionRef,
            failureReason: failureReason,
            idempotencyKey: existing.idempotencyKey,
            createdAt: existing.createdAt,
            updatedAt: new Date(),
          });
          contributionRepo.contributions.set(contributionId, updated);
          return {
            rows: [
              {
                id: updated.id,
                donor_user_id: updated.donorUserId,
                campaign_id: updated.campaignId,
                amount_cents: String(updated.amountCents),
                payment_token: updated.paymentToken,
                status: updated.status,
                transaction_ref: updated.transactionRef,
                failure_reason: updated.failureReason,
                idempotency_key: updated.idempotencyKey,
                created_at: updated.createdAt,
                updated_at: updated.updatedAt,
              },
            ],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      }

      if (
        typeof sql === 'string' &&
        sql.includes('UPDATE campaigns') &&
        sql.includes('total_raised_cents') &&
        params
      ) {
        const [campaignId, amountCents] = params as [string, number];
        const campaign = campaignRepo.campaigns.get(campaignId);
        if (!campaign) return { rows: [], rowCount: 0 };
        return {
          rows: [
            {
              id: campaign.id,
              total_raised_cents: String(amountCents),
              funding_goal_cents: campaign.fundingGoalCents,
              status: campaign.status,
            },
          ],
          rowCount: 1,
        };
      }

      if (typeof sql === 'string' && sql.includes("status = 'funded'") && params) {
        return { rows: [], rowCount: 1 };
      }

      return { rows: [{ prev_balance: '0' }], rowCount: 1 };
    }) as unknown as PoolClient['query'],
    release: vi.fn(),
  };

  return {
    connect: vi.fn(async () => mockClient as PoolClient),
    query: vi.fn(),
  } as unknown as Pool;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeUserData(clerkUserId: string, overrides: Partial<UserData> = {}): UserData {
  return {
    id: crypto.randomUUID(),
    clerkUserId,
    email: `${clerkUserId}@test.mmf`,
    displayName: null,
    bio: null,
    avatarUrl: null,
    accountStatus: AccountStatus.Active,
    onboardingCompleted: false,
    onboardingStep: null,
    roles: [Role.Backer],
    notificationPrefs: NotificationPreferences.defaults(),
    kycStatus: KycStatus.NotStarted,
    lastSeenAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function seedUser(repo: InMemoryUserRepository, clerkUserId: string): User {
  const data = makeUserData(clerkUserId);
  const user = User.reconstitute(data);
  repo.users.set(clerkUserId, user);
  return user;
}

function makeLiveCampaign(overrides: Partial<CampaignData> = {}): Campaign {
  return Campaign.reconstitute({
    id: crypto.randomUUID(),
    creatorUserId: crypto.randomUUID(),
    title: 'Mars Mission Campaign',
    shortDescription: null,
    description: null,
    category: null,
    heroImageUrl: null,
    fundingGoalCents: '1000000',
    fundingCapCents: null,
    deadline: null,
    milestones: [],
    teamMembers: [],
    riskDisclosures: [],
    budgetBreakdown: [],
    alignmentStatement: null,
    tags: [],
    status: 'live',
    rejectionReason: null,
    resubmissionGuidance: null,
    reviewNotes: null,
    reviewedByUserId: null,
    reviewedAt: null,
    submittedAt: null,
    launchedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });
}

// ─── App factory ──────────────────────────────────────────────────────────────

function makeApp(contributionAppService: ContributionAppService): Application {
  const app = express();
  app.use(express.json());
  app.use(correlationIdMiddleware);
  app.use('/api/v1/contributions', createContributionRouter(contributionAppService, logger));
  app.use(createErrorHandler(logger));
  return app;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/v1/contributions', () => {
  let userRepo: InMemoryUserRepository;
  let campaignRepo: InMemoryCampaignRepository;
  let contributionRepo: InMemoryContributionRepository;
  let escrowRepo: InMemoryEscrowLedgerRepository;
  let auditRepo: InMemoryContributionAuditRepository;
  let app: Application;

  const DONOR_CLERK_ID = 'user_donor_router_test_001';
  let liveCampaign: Campaign;

  beforeEach(() => {
    userRepo = new InMemoryUserRepository();
    campaignRepo = new InMemoryCampaignRepository();
    contributionRepo = new InMemoryContributionRepository();
    escrowRepo = new InMemoryEscrowLedgerRepository();
    auditRepo = new InMemoryContributionAuditRepository();

    seedUser(userRepo, DONOR_CLERK_ID);
    liveCampaign = makeLiveCampaign();
    campaignRepo.campaigns.set(liveCampaign.id, liveCampaign);

    const pool = makeMockPool(campaignRepo, contributionRepo);

    const service = new ContributionAppService(
      pool,
      contributionRepo,
      escrowRepo,
      auditRepo,
      campaignRepo,
      userRepo,
      new StubGateway(),
      logger,
    );

    app = makeApp(service);
  });

  it('returns 401 when no auth header provided', async () => {
    const res = await request(app).post('/api/v1/contributions').send({
      campaignId: liveCampaign.id,
      amountCents: '75317',
      paymentToken: 'tok_abc',
    });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('returns 400 for invalid UUID campaignId', async () => {
    const res = await request(app)
      .post('/api/v1/contributions')
      .set('x-test-user-id', DONOR_CLERK_ID)
      .send({
        campaignId: 'not-a-uuid',
        amountCents: '75317',
        paymentToken: 'tok_abc',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 for amountCents below minimum', async () => {
    const res = await request(app)
      .post('/api/v1/contributions')
      .set('x-test-user-id', DONOR_CLERK_ID)
      .send({
        campaignId: liveCampaign.id,
        amountCents: '499',
        paymentToken: 'tok_abc',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 for missing paymentToken', async () => {
    const res = await request(app)
      .post('/api/v1/contributions')
      .set('x-test-user-id', DONOR_CLERK_ID)
      .send({
        campaignId: liveCampaign.id,
        amountCents: '75317',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 201 with captured contribution on happy path', async () => {
    const res = await request(app)
      .post('/api/v1/contributions')
      .set('x-test-user-id', DONOR_CLERK_ID)
      .send({
        campaignId: liveCampaign.id,
        amountCents: '75317',
        paymentToken: 'tok_abc',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('captured');
    expect(res.body.data.amountCents).toBe('75317');
    expect(res.body.data.campaignId).toBe(liveCampaign.id);
    expect(res.body.data.transactionRef).toMatch(/^stub_txn_/);
    // paymentToken must NOT be in response
    expect(res.body.data.paymentToken).toBeUndefined();
  });

  it('returns 201 with failed contribution when tok_fail is used', async () => {
    const res = await request(app)
      .post('/api/v1/contributions')
      .set('x-test-user-id', DONOR_CLERK_ID)
      .send({
        campaignId: liveCampaign.id,
        amountCents: '75317',
        paymentToken: 'tok_fail',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('failed');
    expect(res.body.data.failureReason).toBeTruthy();
    expect(res.body.data.transactionRef).toBeNull();
  });

  it('returns 409 when duplicate contribution is detected', async () => {
    contributionRepo.setDuplicateOverride(true);

    const res = await request(app)
      .post('/api/v1/contributions')
      .set('x-test-user-id', DONOR_CLERK_ID)
      .send({
        campaignId: liveCampaign.id,
        amountCents: '75317',
        paymentToken: 'tok_abc',
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DUPLICATE_CONTRIBUTION');
  });

  it('returns 422 when campaign is not live', async () => {
    const fundedCampaign = makeLiveCampaign({ status: 'funded' });
    campaignRepo.campaigns.set(fundedCampaign.id, fundedCampaign);

    const res = await request(app)
      .post('/api/v1/contributions')
      .set('x-test-user-id', DONOR_CLERK_ID)
      .send({
        campaignId: fundedCampaign.id,
        amountCents: '75317',
        paymentToken: 'tok_abc',
      });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('CAMPAIGN_NOT_ACCEPTING_CONTRIBUTIONS');
  });

  it('returns 404 when campaign does not exist', async () => {
    const res = await request(app)
      .post('/api/v1/contributions')
      .set('x-test-user-id', DONOR_CLERK_ID)
      .send({
        campaignId: crypto.randomUUID(),
        amountCents: '75317',
        paymentToken: 'tok_abc',
      });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('CAMPAIGN_NOT_FOUND');
  });

  it('serializes amountCents as string in response (G-024 monetary rule)', async () => {
    const res = await request(app)
      .post('/api/v1/contributions')
      .set('x-test-user-id', DONOR_CLERK_ID)
      .send({
        campaignId: liveCampaign.id,
        amountCents: 75317, // Send as number
        paymentToken: 'tok_abc',
      });

    expect(res.status).toBe(201);
    expect(typeof res.body.data.amountCents).toBe('string');
    expect(res.body.data.amountCents).toBe('75317');
  });
});

describe('GET /api/v1/contributions/:id', () => {
  let userRepo: InMemoryUserRepository;
  let campaignRepo: InMemoryCampaignRepository;
  let contributionRepo: InMemoryContributionRepository;
  let escrowRepo: InMemoryEscrowLedgerRepository;
  let auditRepo: InMemoryContributionAuditRepository;
  let app: Application;

  const DONOR_CLERK_ID = 'user_donor_get_test_001';
  let liveCampaign: Campaign;
  let service: ContributionAppService;

  beforeEach(() => {
    userRepo = new InMemoryUserRepository();
    campaignRepo = new InMemoryCampaignRepository();
    contributionRepo = new InMemoryContributionRepository();
    escrowRepo = new InMemoryEscrowLedgerRepository();
    auditRepo = new InMemoryContributionAuditRepository();

    seedUser(userRepo, DONOR_CLERK_ID);
    liveCampaign = makeLiveCampaign();
    campaignRepo.campaigns.set(liveCampaign.id, liveCampaign);

    const pool = makeMockPool(campaignRepo, contributionRepo);

    service = new ContributionAppService(
      pool,
      contributionRepo,
      escrowRepo,
      auditRepo,
      campaignRepo,
      userRepo,
      new StubGateway(),
      logger,
    );

    app = makeApp(service);
  });

  it('returns 401 when no auth header provided', async () => {
    const res = await request(app).get(`/api/v1/contributions/${crypto.randomUUID()}`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('returns 404 for unknown contribution ID', async () => {
    const res = await request(app)
      .get(`/api/v1/contributions/${crypto.randomUUID()}`)
      .set('x-test-user-id', DONOR_CLERK_ID);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 200 with contribution data for own contribution', async () => {
    const created = await service.createContribution(DONOR_CLERK_ID, {
      campaignId: liveCampaign.id,
      amountCents: 75317,
      paymentToken: 'tok_abc',
    });

    const res = await request(app)
      .get(`/api/v1/contributions/${created.id}`)
      .set('x-test-user-id', DONOR_CLERK_ID);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(created.id);
    expect(res.body.data.status).toBe('captured');
  });

  it('returns 404 when contribution belongs to another user (security)', async () => {
    const created = await service.createContribution(DONOR_CLERK_ID, {
      campaignId: liveCampaign.id,
      amountCents: 75317,
      paymentToken: 'tok_abc',
    });

    // Other user tries to access it
    const otherUser = seedUser(userRepo, 'user_other_test_002');

    const res = await request(app)
      .get(`/api/v1/contributions/${created.id}`)
      .set('x-test-user-id', otherUser.clerkUserId);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
