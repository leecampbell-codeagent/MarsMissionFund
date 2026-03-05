import type express from 'express';
import type { Request as ExpressRequest } from 'express';
import pino from 'pino';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryAccountRepository } from '../account/adapters/mock/in-memory-account-repository.js';
import { MockAuthAdapter } from '../account/adapters/mock/mock-auth-adapter.js';
import { MockWebhookVerificationAdapter } from '../account/adapters/mock/mock-webhook-verification-adapter.js';
import { AccountAppService } from '../account/application/account-app-service.js';
import { type AppDependencies, createApp } from '../app.js';
import { InMemoryContributionRepository } from '../payments/adapters/mock/in-memory-contribution-repository.js';
import { InMemoryEscrowLedgerRepository } from '../payments/adapters/mock/in-memory-escrow-ledger-repository.js';
import { InMemoryProcessedWebhookEventRepository } from '../payments/adapters/mock/in-memory-processed-webhook-event-repository.js';
import { MockPaymentGatewayAdapter } from '../payments/adapters/mock/mock-payment-gateway-adapter.js';
import { PaymentAppService } from '../payments/application/payment-app-service.js';
import { Contribution } from '../payments/domain/contribution.js';
import { InMemoryEventStoreAdapter } from '../shared/adapters/mock/in-memory-event-store-adapter.js';
import { InMemoryTransactionAdapter } from '../shared/adapters/mock/in-memory-transaction-adapter.js';
import type { AuthClaimsExtractor } from '../shared/middleware/enrich-auth-context.js';
import type { AuthExtractor } from '../shared/middleware/require-authentication.js';

const testLogger = pino({ level: 'silent' });

interface MockAuth {
  userId?: string;
  sessionClaims?: { email?: string; firstName?: string; lastName?: string };
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
  contributionRepo: InMemoryContributionRepository;
  escrowLedgerRepo: InMemoryEscrowLedgerRepository;
  processedWebhookRepo: InMemoryProcessedWebhookEventRepository;
  eventStore: InMemoryEventStoreAdapter;
}

function createTestContext(): TestContext {
  const accountRepo = new InMemoryAccountRepository();
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

  return { app: createApp(deps), contributionRepo, escrowLedgerRepo, processedWebhookRepo, eventStore };
}

function makeWebhookBody(overrides: Record<string, unknown> = {}): string {
  const body = {
    id: 'evt_test_001',
    type: 'payment_intent.succeeded',
    data: {
      object: {
        id: 'pi_mock_contrib_001',
        amount: 250099,
        metadata: { contributionId: 'contrib-uuid-001' },
      },
    },
    ...overrides,
  };
  return JSON.stringify(body);
}

describe('POST /api/v1/payments/webhook', () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestContext();
  });

  it('returns 200 for a valid payment_intent.succeeded event', async () => {
    // Seed a pending contribution that will be captured via webhook
    const contribution = Contribution.reconstitute({
      id: 'contrib-uuid-001',
      donorId: 'donor-uuid-001',
      campaignId: 'campaign-uuid-001',
      amountCents: 250099,
      status: 'pending_capture',
      gatewayReference: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    ctx.contributionRepo.seed(contribution);

    const response = await request(ctx.app)
      .post('/api/v1/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 'mock_sig')
      .send(makeWebhookBody());

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ received: true });
  });

  it('transitions contribution to captured state via payment_intent.succeeded webhook', async () => {
    const contribution = Contribution.reconstitute({
      id: 'contrib-uuid-001',
      donorId: 'donor-uuid-001',
      campaignId: 'campaign-uuid-001',
      amountCents: 250099,
      status: 'pending_capture',
      gatewayReference: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    ctx.contributionRepo.seed(contribution);

    await request(ctx.app)
      .post('/api/v1/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 'mock_sig')
      .send(makeWebhookBody());

    const updated = await ctx.contributionRepo.findById('contrib-uuid-001');
    expect(updated?.status).toBe('captured');
    expect(updated?.gatewayReference).toBe('pi_mock_contrib_001');
  });

  it('transitions contribution to failed via payment_intent.payment_failed webhook', async () => {
    const contribution = Contribution.reconstitute({
      id: 'contrib-uuid-002',
      donorId: 'donor-uuid-001',
      campaignId: 'campaign-uuid-001',
      amountCents: 250099,
      status: 'pending_capture',
      gatewayReference: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    ctx.contributionRepo.seed(contribution);

    const body = makeWebhookBody({
      id: 'evt_test_002',
      type: 'payment_intent.payment_failed',
      data: {
        object: {
          id: 'pi_mock_contrib_002',
          amount: 250099,
          metadata: { contributionId: 'contrib-uuid-002' },
        },
      },
    });

    const response = await request(ctx.app)
      .post('/api/v1/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 'mock_sig')
      .send(body);

    expect(response.status).toBe(200);

    const updated = await ctx.contributionRepo.findById('contrib-uuid-002');
    expect(updated?.status).toBe('failed');
  });

  it('returns 200 idempotently for duplicate event (already processed)', async () => {
    // Pre-mark the event as processed
    await ctx.processedWebhookRepo.markAsProcessed('evt_test_001', 'payment_intent.succeeded');

    const contribution = Contribution.reconstitute({
      id: 'contrib-uuid-001',
      donorId: 'donor-uuid-001',
      campaignId: 'campaign-uuid-001',
      amountCents: 250099,
      status: 'pending_capture',
      gatewayReference: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    ctx.contributionRepo.seed(contribution);

    const response = await request(ctx.app)
      .post('/api/v1/payments/webhook')
      .set('stripe-signature', 'mock_sig')
      .send(makeWebhookBody());

    expect(response.status).toBe(200);

    // State should NOT have changed since we skipped processing
    const unchanged = await ctx.contributionRepo.findById('contrib-uuid-001');
    expect(unchanged?.status).toBe('pending_capture');
  });

  it('returns 200 for unknown event type with no state changes', async () => {
    const body = JSON.stringify({
      id: 'evt_unknown_001',
      type: 'some_unknown_event',
      data: { object: {} },
    });

    const response = await request(ctx.app)
      .post('/api/v1/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 'mock_sig')
      .send(body);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ received: true });
  });

  it('returns 200 for already-captured contribution (idempotent webhook)', async () => {
    // Contribution is already captured
    const contribution = Contribution.reconstitute({
      id: 'contrib-uuid-001',
      donorId: 'donor-uuid-001',
      campaignId: 'campaign-uuid-001',
      amountCents: 250099,
      status: 'captured',
      gatewayReference: 'pi_existing',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    ctx.contributionRepo.seed(contribution);

    const response = await request(ctx.app)
      .post('/api/v1/payments/webhook')
      .set('stripe-signature', 'mock_sig')
      .send(makeWebhookBody());

    expect(response.status).toBe(200);

    // State should not have changed
    const unchanged = await ctx.contributionRepo.findById('contrib-uuid-001');
    expect(unchanged?.status).toBe('captured');
    expect(unchanged?.gatewayReference).toBe('pi_existing');
  });
});
