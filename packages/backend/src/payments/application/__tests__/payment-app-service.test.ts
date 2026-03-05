import pino from 'pino';
import { describe, expect, it } from 'vitest';
import { InMemoryContributionRepository } from '../../adapters/mock/in-memory-contribution-repository.js';
import { InMemoryEscrowLedgerRepository } from '../../adapters/mock/in-memory-escrow-ledger-repository.js';
import { InMemoryProcessedWebhookEventRepository } from '../../adapters/mock/in-memory-processed-webhook-event-repository.js';
import { MockPaymentGatewayAdapter } from '../../adapters/mock/mock-payment-gateway-adapter.js';
import { Contribution } from '../../domain/contribution.js';
import { InvalidContributionAmountError, PaymentGatewayError } from '../../domain/payment-errors.js';
import { InMemoryEventStoreAdapter } from '../../../shared/adapters/mock/in-memory-event-store-adapter.js';
import { InMemoryTransactionAdapter } from '../../../shared/adapters/mock/in-memory-transaction-adapter.js';
import { PaymentAppService } from '../payment-app-service.js';

const testLogger = pino({ level: 'silent' });

function createService() {
  const contributionRepo = new InMemoryContributionRepository();
  const escrowLedgerRepo = new InMemoryEscrowLedgerRepository();
  const processedWebhookRepo = new InMemoryProcessedWebhookEventRepository();
  const paymentGateway = new MockPaymentGatewayAdapter();
  const eventStore = new InMemoryEventStoreAdapter();
  const transactionPort = new InMemoryTransactionAdapter();

  const service = new PaymentAppService(
    contributionRepo,
    escrowLedgerRepo,
    processedWebhookRepo,
    paymentGateway,
    eventStore,
    transactionPort,
    testLogger,
  );

  return { service, contributionRepo, escrowLedgerRepo, processedWebhookRepo, eventStore };
}

describe('PaymentAppService.captureContribution', () => {
  it('creates a captured contribution and escrow entry on success', async () => {
    const { service, contributionRepo, escrowLedgerRepo, eventStore } = createService();

    const result = await service.captureContribution({
      donorId: 'donor-uuid-001',
      campaignId: 'campaign-uuid-001',
      amountCents: 250099,
      paymentMethodToken: 'tok_visa',
    });

    expect(result.status).toBe('captured');
    expect(result.gatewayReference).toMatch(/^pi_mock_/);

    const contributions = contributionRepo.getAll();
    expect(contributions).toHaveLength(1);
    expect(contributions[0]?.status).toBe('captured');

    const entries = await escrowLedgerRepo.getEntriesForCampaign('campaign-uuid-001');
    expect(entries).toHaveLength(1);
    expect(entries[0]?.entryType).toBe('contribution');

    const events = eventStore.events;
    expect(events.some((e) => e.eventType === 'PAYMENT.CONTRIBUTION_CAPTURED')).toBe(true);
  });

  it('creates a failed contribution (no escrow entry) for declined card', async () => {
    const { service, contributionRepo, escrowLedgerRepo } = createService();

    await expect(
      service.captureContribution({
        donorId: 'donor-uuid-001',
        campaignId: 'campaign-uuid-001',
        amountCents: 250099,
        paymentMethodToken: 'tok_chargeDeclined',
      }),
    ).rejects.toThrow(PaymentGatewayError);

    const contributions = contributionRepo.getAll();
    expect(contributions).toHaveLength(1);
    expect(contributions[0]?.status).toBe('failed');

    const entries = await escrowLedgerRepo.getEntriesForCampaign('campaign-uuid-001');
    expect(entries).toHaveLength(0);
  });

  it('throws InvalidContributionAmountError for amount < 100', async () => {
    const { service } = createService();

    await expect(
      service.captureContribution({
        donorId: 'donor-uuid-001',
        campaignId: 'campaign-uuid-001',
        amountCents: 99,
        paymentMethodToken: 'tok_visa',
      }),
    ).rejects.toThrow(InvalidContributionAmountError);
  });
});

describe('PaymentAppService.processWebhookEvent', () => {
  it('transitions contribution to captured for payment_intent.succeeded', async () => {
    const { service, contributionRepo } = createService();

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
    contributionRepo.seed(contribution);

    const body = Buffer.from(
      JSON.stringify({
        id: 'evt_test_001',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_mock_001',
            amount: 250099,
            metadata: { contributionId: 'contrib-uuid-001' },
          },
        },
      }),
    );

    await service.processWebhookEvent(body, 'mock_sig');

    const updated = await contributionRepo.findById('contrib-uuid-001');
    expect(updated?.status).toBe('captured');
    expect(updated?.gatewayReference).toBe('pi_mock_001');
  });

  it('transitions contribution to failed for payment_intent.payment_failed', async () => {
    const { service, contributionRepo } = createService();

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
    contributionRepo.seed(contribution);

    const body = Buffer.from(
      JSON.stringify({
        id: 'evt_test_002',
        type: 'payment_intent.payment_failed',
        data: {
          object: {
            id: 'pi_mock_002',
            amount: 250099,
            metadata: { contributionId: 'contrib-uuid-002' },
          },
        },
      }),
    );

    await service.processWebhookEvent(body, 'mock_sig');

    const updated = await contributionRepo.findById('contrib-uuid-002');
    expect(updated?.status).toBe('failed');
  });

  it('is idempotent for duplicate event IDs', async () => {
    const { service, processedWebhookRepo } = createService();

    await processedWebhookRepo.markAsProcessed('evt_test_dup', 'payment_intent.succeeded');

    const body = Buffer.from(
      JSON.stringify({
        id: 'evt_test_dup',
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_mock', metadata: {} } },
      }),
    );

    // Should not throw and should not process
    await service.processWebhookEvent(body, 'mock_sig');

    // Still processed (idempotent)
    const stillProcessed = await processedWebhookRepo.hasBeenProcessed('evt_test_dup');
    expect(stillProcessed).toBe(true);
  });

  it('ignores unknown event types', async () => {
    const { service } = createService();

    const body = Buffer.from(
      JSON.stringify({
        id: 'evt_unknown',
        type: 'some.unknown.event',
        data: { object: {} },
      }),
    );

    // Should not throw
    await service.processWebhookEvent(body, 'mock_sig');
  });
});

describe('PaymentAppService.getEscrowBalance', () => {
  it('returns 0 balance for campaign with no entries', async () => {
    const { service } = createService();

    const result = await service.getEscrowBalance('campaign-uuid-001');
    expect(result.balanceCents).toBe(0);
    expect(result.entryCount).toBe(0);
  });

  it('returns correct balance after capture', async () => {
    const { service } = createService();

    await service.captureContribution({
      donorId: 'donor-uuid-001',
      campaignId: 'campaign-uuid-001',
      amountCents: 250099,
      paymentMethodToken: 'tok_visa',
    });

    const result = await service.getEscrowBalance('campaign-uuid-001');
    expect(result.balanceCents).toBe(250099);
    expect(result.entryCount).toBe(1);
  });
});
