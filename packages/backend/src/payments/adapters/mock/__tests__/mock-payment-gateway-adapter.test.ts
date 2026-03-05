import { describe, expect, it } from 'vitest';
import { MockPaymentGatewayAdapter } from '../mock-payment-gateway-adapter.js';

const adapter = new MockPaymentGatewayAdapter();

const baseInput = {
  contributionId: 'contrib-uuid-001',
  amountCents: 250099,
  currency: 'usd' as const,
  metadata: {
    campaignId: 'campaign-uuid-001',
    donorId: 'donor-uuid-001',
    contributionId: 'contrib-uuid-001',
  },
};

describe('MockPaymentGatewayAdapter.capturePayment', () => {
  it('returns success for tok_visa token', async () => {
    const result = await adapter.capturePayment({ ...baseInput, paymentMethodToken: 'tok_visa' });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.gatewayReference).toBe(`pi_mock_${baseInput.contributionId}`);
    }
  });

  it('returns success for tok_success token', async () => {
    const result = await adapter.capturePayment({ ...baseInput, paymentMethodToken: 'tok_success' });

    expect(result.success).toBe(true);
  });

  it('returns success for any other token (default)', async () => {
    const result = await adapter.capturePayment({ ...baseInput, paymentMethodToken: 'tok_unknown_abc' });

    expect(result.success).toBe(true);
  });

  it('returns failure with CARD_DECLINED for tok_chargeDeclined token', async () => {
    const result = await adapter.capturePayment({
      ...baseInput,
      paymentMethodToken: 'tok_chargeDeclined',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errorCode).toBe('CARD_DECLINED');
      expect(result.errorMessage).toBeTruthy();
    }
  });

  it('returns failure with INSUFFICIENT_FUNDS for tok_insufficient_funds token', async () => {
    const result = await adapter.capturePayment({
      ...baseInput,
      paymentMethodToken: 'tok_insufficient_funds',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errorCode).toBe('INSUFFICIENT_FUNDS');
      expect(result.errorMessage).toBeTruthy();
    }
  });
});

describe('MockPaymentGatewayAdapter.refundPayment', () => {
  it('returns success with a refund reference', async () => {
    const result = await adapter.refundPayment({
      gatewayReference: 'pi_mock_contrib123',
      amountCents: 250099,
      reason: 'requested_by_customer',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.refundReference).toMatch(/^re_mock_/);
    }
  });
});

describe('MockPaymentGatewayAdapter.parseWebhookEvent', () => {
  it('parses a payment_intent.succeeded event', async () => {
    const body = {
      id: 'evt_001',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_mock_contrib123',
          amount: 250099,
          metadata: { contributionId: 'contrib-uuid-001' },
        },
      },
    };

    const event = await adapter.parseWebhookEvent(
      Buffer.from(JSON.stringify(body)),
      'mock_sig',
    );

    expect(event.eventId).toBe('evt_001');
    expect(event.eventType).toBe('payment_intent.succeeded');
    expect(event.contributionId).toBe('contrib-uuid-001');
    expect(event.gatewayReference).toBe('pi_mock_contrib123');
    expect(event.amountCents).toBe(250099);
  });

  it('returns unknown eventType for unrecognised event type', async () => {
    const body = {
      id: 'evt_002',
      type: 'some_unknown_type',
      data: { object: {} },
    };

    const event = await adapter.parseWebhookEvent(
      Buffer.from(JSON.stringify(body)),
      'mock_sig',
    );

    expect(event.eventType).toBe('unknown');
  });
});
