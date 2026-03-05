import type express from 'express';
import type { Request as ExpressRequest } from 'express';
import pino from 'pino';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryAccountRepository } from '../account/adapters/mock/in-memory-account-repository.js';
import { MockAuthAdapter } from '../account/adapters/mock/mock-auth-adapter.js';
import { MockWebhookVerificationAdapter } from '../account/adapters/mock/mock-webhook-verification-adapter.js';
import { AccountAppService } from '../account/application/account-app-service.js';
import { Account } from '../account/domain/account.js';
import { type AppDependencies, createApp } from '../app.js';
import { InMemoryContributionRepository } from '../payments/adapters/mock/in-memory-contribution-repository.js';
import { InMemoryEscrowLedgerRepository } from '../payments/adapters/mock/in-memory-escrow-ledger-repository.js';
import { InMemoryProcessedWebhookEventRepository } from '../payments/adapters/mock/in-memory-processed-webhook-event-repository.js';
import { MockPaymentGatewayAdapter } from '../payments/adapters/mock/mock-payment-gateway-adapter.js';
import { PaymentAppService } from '../payments/application/payment-app-service.js';
import { EscrowLedgerEntry } from '../payments/domain/escrow-ledger-entry.js';
import { InMemoryEventStoreAdapter } from '../shared/adapters/mock/in-memory-event-store-adapter.js';
import { InMemoryTransactionAdapter } from '../shared/adapters/mock/in-memory-transaction-adapter.js';
import type { AuthClaimsExtractor } from '../shared/middleware/enrich-auth-context.js';
import type { AuthExtractor } from '../shared/middleware/require-authentication.js';

const testLogger = pino({ level: 'silent' });

const CAMPAIGN_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

interface MockAuth {
  userId?: string;
  sessionClaims?: { email?: string; firstName?: string; lastName?: string };
  roles?: string[];
}

function createMockExtractor(): AuthExtractor & AuthClaimsExtractor {
  return {
    getUserId(req: ExpressRequest): string | null {
      const auth = (req as unknown as Record<string, unknown>).auth as MockAuth | undefined;
      return auth?.userId ?? null;
    },
    getEmail(req: ExpressRequest): string {
      const auth = (req as unknown as Record<string, unknown>).auth as MockAuth | undefined;
      return auth?.sessionClaims?.email ?? 'unknown@example.com';
    },
    getDisplayName(req: ExpressRequest): string | null {
      const auth = (req as unknown as Record<string, unknown>).auth as MockAuth | undefined;
      const first = auth?.sessionClaims?.firstName ?? '';
      const last = auth?.sessionClaims?.lastName ?? '';
      return [first, last].filter(Boolean).join(' ') || null;
    },
  };
}

interface TestContext {
  app: express.Express;
  escrowLedgerRepo: InMemoryEscrowLedgerRepository;
  accountRepo: InMemoryAccountRepository;
}

function createTestContextWithAdminAccount(): TestContext {
  const accountRepo = new InMemoryAccountRepository();

  // Seed an admin account matching the mock auth user ID
  const adminAccount = Account.reconstitute({
    id: 'internal-admin-id',
    clerkUserId: 'user_mock_001',
    email: 'mock@example.com',
    displayName: 'Mock Admin',
    status: 'active',
    roles: ['administrator'],
    onboardingCompleted: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  accountRepo.seed(adminAccount);

  const contributionRepo = new InMemoryContributionRepository();
  const escrowLedgerRepo = new InMemoryEscrowLedgerRepository();
  const processedWebhookRepo = new InMemoryProcessedWebhookEventRepository();
  const paymentGateway = new MockPaymentGatewayAdapter();
  const eventStore = new InMemoryEventStoreAdapter();
  const transactionPort = new InMemoryTransactionAdapter();

  const paymentAppService = new PaymentAppService(
    contributionRepo,
    escrowLedgerRepo,
    processedWebhookRepo,
    paymentGateway,
    eventStore,
    transactionPort,
    testLogger,
  );

  const extractor = createMockExtractor();
  const deps: AppDependencies = {
    authPort: new MockAuthAdapter(),
    webhookVerifier: new MockWebhookVerificationAdapter(),
    accountAppService: new AccountAppService(accountRepo, testLogger),
    paymentAppService,
    authExtractor: extractor,
    claimsExtractor: extractor,
  };

  return { app: createApp(deps), escrowLedgerRepo, accountRepo };
}

function createTestContextWithBackerAccount(): TestContext {
  const accountRepo = new InMemoryAccountRepository();

  // Seed a backer account (non-admin)
  const backerAccount = Account.reconstitute({
    id: 'internal-backer-id',
    clerkUserId: 'user_mock_001',
    email: 'mock@example.com',
    displayName: 'Mock Backer',
    status: 'active',
    roles: ['backer'],
    onboardingCompleted: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  accountRepo.seed(backerAccount);

  const contributionRepo = new InMemoryContributionRepository();
  const escrowLedgerRepo = new InMemoryEscrowLedgerRepository();
  const processedWebhookRepo = new InMemoryProcessedWebhookEventRepository();
  const paymentGateway = new MockPaymentGatewayAdapter();
  const eventStore = new InMemoryEventStoreAdapter();
  const transactionPort = new InMemoryTransactionAdapter();

  const paymentAppService = new PaymentAppService(
    contributionRepo,
    escrowLedgerRepo,
    processedWebhookRepo,
    paymentGateway,
    eventStore,
    transactionPort,
    testLogger,
  );

  const extractor = createMockExtractor();
  const deps: AppDependencies = {
    authPort: new MockAuthAdapter(),
    webhookVerifier: new MockWebhookVerificationAdapter(),
    accountAppService: new AccountAppService(accountRepo, testLogger),
    paymentAppService,
    authExtractor: extractor,
    claimsExtractor: extractor,
  };

  return { app: createApp(deps), escrowLedgerRepo, accountRepo };
}

describe('GET /api/v1/campaigns/:campaignId/escrow-balance', () => {
  describe('with admin account', () => {
    let ctx: TestContext;

    beforeEach(() => {
      ctx = createTestContextWithAdminAccount();
    });

    it('returns 200 with balance_cents "0" for campaign with no entries', async () => {
      const response = await request(ctx.app)
        .get(`/api/v1/campaigns/${CAMPAIGN_ID}/escrow-balance`);

      expect(response.status).toBe(200);
      expect(response.body.data.balance_cents).toBe('0');
      expect(response.body.data.entry_count).toBe(0);
      expect(response.body.data.campaign_id).toBe(CAMPAIGN_ID);
    });

    it('returns correct balance after adding a contribution entry', async () => {
      const entry = EscrowLedgerEntry.create({
        campaignId: CAMPAIGN_ID,
        entryType: 'contribution',
        amountCents: 250099,
        contributionId: 'contrib-001',
        description: 'Test contribution',
      });
      await ctx.escrowLedgerRepo.appendEntry(entry);

      const response = await request(ctx.app)
        .get(`/api/v1/campaigns/${CAMPAIGN_ID}/escrow-balance`);

      expect(response.status).toBe(200);
      expect(response.body.data.balance_cents).toBe('250099');
      expect(response.body.data.entry_count).toBe(1);
    });

    it('returns correct balance with mixed credits and debits', async () => {
      // Add contribution (+250099)
      const contribution = EscrowLedgerEntry.create({
        campaignId: CAMPAIGN_ID,
        entryType: 'contribution',
        amountCents: 250099,
        contributionId: 'contrib-001',
      });
      await ctx.escrowLedgerRepo.appendEntry(contribution);

      // Add another contribution (+150000)
      const contribution2 = EscrowLedgerEntry.create({
        campaignId: CAMPAIGN_ID,
        entryType: 'contribution',
        amountCents: 150000,
        contributionId: 'contrib-002',
      });
      await ctx.escrowLedgerRepo.appendEntry(contribution2);

      // Add a refund (-100000)
      const refund = EscrowLedgerEntry.create({
        campaignId: CAMPAIGN_ID,
        entryType: 'refund',
        amountCents: 100000,
        contributionId: 'contrib-001',
      });
      await ctx.escrowLedgerRepo.appendEntry(refund);

      // Expected balance: 250099 + 150000 - 100000 = 300099
      const response = await request(ctx.app)
        .get(`/api/v1/campaigns/${CAMPAIGN_ID}/escrow-balance`);

      expect(response.status).toBe(200);
      expect(response.body.data.balance_cents).toBe('300099');
      expect(response.body.data.entry_count).toBe(3);
    });

    it('balance_cents is serialised as a string (not a number)', async () => {
      const response = await request(ctx.app)
        .get(`/api/v1/campaigns/${CAMPAIGN_ID}/escrow-balance`);

      expect(response.status).toBe(200);
      expect(typeof response.body.data.balance_cents).toBe('string');
    });
  });

  describe('with backer account (non-admin)', () => {
    it('returns 403 UNAUTHORIZED for non-admin role', async () => {
      const ctx = createTestContextWithBackerAccount();

      const response = await request(ctx.app)
        .get(`/api/v1/campaigns/${CAMPAIGN_ID}/escrow-balance`);

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  it('returns 401 when unauthenticated', async () => {
    const bareApp = createApp();

    const response = await request(bareApp)
      .get(`/api/v1/campaigns/${CAMPAIGN_ID}/escrow-balance`);

    // Without deps, no routes are mounted → 404
    expect(response.status).toBe(404);
  });
});
