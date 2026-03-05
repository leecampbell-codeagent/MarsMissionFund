import { describe, expect, it } from 'vitest';
import { Contribution } from '../contribution.js';
import {
  InvalidContributionAmountError,
  InvalidContributionDataError,
  InvalidContributionStateError,
} from '../payment-errors.js';

describe('Contribution.create', () => {
  it('creates a contribution with valid input', () => {
    const contribution = Contribution.create({
      donorId: 'donor-uuid-001',
      campaignId: 'campaign-uuid-001',
      amountCents: 250099,
    });

    expect(contribution.id).toBeDefined();
    expect(contribution.donorId).toBe('donor-uuid-001');
    expect(contribution.campaignId).toBe('campaign-uuid-001');
    expect(contribution.amountCents).toBe(250099);
    expect(contribution.status).toBe('pending_capture');
    expect(contribution.gatewayReference).toBeNull();
    expect(contribution.createdAt).toBeInstanceOf(Date);
    expect(contribution.updatedAt).toBeInstanceOf(Date);
  });

  it('rejects amountCents < 100 with InvalidContributionAmountError', () => {
    expect(() =>
      Contribution.create({ donorId: 'donor-uuid-001', campaignId: 'campaign-uuid-001', amountCents: 99 }),
    ).toThrow(InvalidContributionAmountError);
  });

  it('rejects amountCents = 0 with InvalidContributionAmountError', () => {
    expect(() =>
      Contribution.create({ donorId: 'donor-uuid-001', campaignId: 'campaign-uuid-001', amountCents: 0 }),
    ).toThrow(InvalidContributionAmountError);
  });

  it('rejects non-integer amountCents (e.g., 10.5) with InvalidContributionAmountError', () => {
    expect(() =>
      Contribution.create({ donorId: 'donor-uuid-001', campaignId: 'campaign-uuid-001', amountCents: 10.5 }),
    ).toThrow(InvalidContributionAmountError);
  });

  it('accepts the minimum valid amount of 100 cents', () => {
    const contribution = Contribution.create({
      donorId: 'donor-uuid-001',
      campaignId: 'campaign-uuid-001',
      amountCents: 100,
    });
    expect(contribution.amountCents).toBe(100);
  });

  it('rejects empty donorId with InvalidContributionDataError', () => {
    expect(() =>
      Contribution.create({ donorId: '', campaignId: 'campaign-uuid-001', amountCents: 250099 }),
    ).toThrow(InvalidContributionDataError);
  });

  it('rejects whitespace-only donorId with InvalidContributionDataError', () => {
    expect(() =>
      Contribution.create({ donorId: '   ', campaignId: 'campaign-uuid-001', amountCents: 250099 }),
    ).toThrow(InvalidContributionDataError);
  });

  it('rejects empty campaignId with InvalidContributionDataError', () => {
    expect(() =>
      Contribution.create({ donorId: 'donor-uuid-001', campaignId: '', amountCents: 250099 }),
    ).toThrow(InvalidContributionDataError);
  });

  it('accepts very large amounts (BIGINT range)', () => {
    const contribution = Contribution.create({
      donorId: 'donor-uuid-001',
      campaignId: 'campaign-uuid-001',
      amountCents: 999999999900,
    });
    expect(contribution.amountCents).toBe(999999999900);
  });
});

describe('Contribution.capture', () => {
  it('transitions pending_capture → captured and sets gatewayReference', () => {
    const contribution = Contribution.create({
      donorId: 'donor-uuid-001',
      campaignId: 'campaign-uuid-001',
      amountCents: 250099,
    });

    const captured = contribution.capture('pi_stripe_abc123');

    expect(captured.status).toBe('captured');
    expect(captured.gatewayReference).toBe('pi_stripe_abc123');
    // Original is immutable
    expect(contribution.status).toBe('pending_capture');
    expect(contribution.gatewayReference).toBeNull();
  });

  it('throws InvalidContributionStateError when already captured', () => {
    const contribution = Contribution.reconstitute({
      id: 'contrib-001',
      donorId: 'donor-001',
      campaignId: 'campaign-001',
      amountCents: 250099,
      status: 'captured',
      gatewayReference: 'pi_existing',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    expect(() => contribution.capture('pi_new')).toThrow(InvalidContributionStateError);
  });

  it('throws InvalidContributionStateError when in failed state', () => {
    const contribution = Contribution.reconstitute({
      id: 'contrib-001',
      donorId: 'donor-001',
      campaignId: 'campaign-001',
      amountCents: 250099,
      status: 'failed',
      gatewayReference: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    expect(() => contribution.capture('pi_new')).toThrow(InvalidContributionStateError);
  });
});

describe('Contribution.fail', () => {
  it('transitions pending_capture → failed', () => {
    const contribution = Contribution.create({
      donorId: 'donor-uuid-001',
      campaignId: 'campaign-uuid-001',
      amountCents: 250099,
    });

    const failed = contribution.fail();

    expect(failed.status).toBe('failed');
    // Original is immutable
    expect(contribution.status).toBe('pending_capture');
  });

  it('throws InvalidContributionStateError when already captured', () => {
    const contribution = Contribution.reconstitute({
      id: 'contrib-001',
      donorId: 'donor-001',
      campaignId: 'campaign-001',
      amountCents: 250099,
      status: 'captured',
      gatewayReference: 'pi_existing',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    expect(() => contribution.fail()).toThrow(InvalidContributionStateError);
  });

  it('throws InvalidContributionStateError when already failed', () => {
    const contribution = Contribution.reconstitute({
      id: 'contrib-001',
      donorId: 'donor-001',
      campaignId: 'campaign-001',
      amountCents: 250099,
      status: 'failed',
      gatewayReference: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    expect(() => contribution.fail()).toThrow(InvalidContributionStateError);
  });
});

describe('Contribution.refund', () => {
  it('transitions captured → refunded', () => {
    const contribution = Contribution.reconstitute({
      id: 'contrib-001',
      donorId: 'donor-001',
      campaignId: 'campaign-001',
      amountCents: 250099,
      status: 'captured',
      gatewayReference: 'pi_existing',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const refunded = contribution.refund();
    expect(refunded.status).toBe('refunded');
    expect(contribution.status).toBe('captured');
  });

  it('transitions partially_refunded → refunded', () => {
    const contribution = Contribution.reconstitute({
      id: 'contrib-001',
      donorId: 'donor-001',
      campaignId: 'campaign-001',
      amountCents: 250099,
      status: 'partially_refunded',
      gatewayReference: 'pi_existing',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const refunded = contribution.refund();
    expect(refunded.status).toBe('refunded');
  });

  it('throws InvalidContributionStateError from pending_capture', () => {
    const contribution = Contribution.create({
      donorId: 'donor-001',
      campaignId: 'campaign-001',
      amountCents: 250099,
    });

    expect(() => contribution.refund()).toThrow(InvalidContributionStateError);
  });

  it('throws InvalidContributionStateError from failed', () => {
    const contribution = Contribution.reconstitute({
      id: 'contrib-001',
      donorId: 'donor-001',
      campaignId: 'campaign-001',
      amountCents: 250099,
      status: 'failed',
      gatewayReference: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    expect(() => contribution.refund()).toThrow(InvalidContributionStateError);
  });
});

describe('Contribution.partiallyRefund', () => {
  it('transitions captured → partially_refunded', () => {
    const contribution = Contribution.reconstitute({
      id: 'contrib-001',
      donorId: 'donor-001',
      campaignId: 'campaign-001',
      amountCents: 250099,
      status: 'captured',
      gatewayReference: 'pi_existing',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const partial = contribution.partiallyRefund();
    expect(partial.status).toBe('partially_refunded');
    expect(contribution.status).toBe('captured');
  });

  it('throws InvalidContributionStateError from pending_capture', () => {
    const contribution = Contribution.create({
      donorId: 'donor-001',
      campaignId: 'campaign-001',
      amountCents: 250099,
    });

    expect(() => contribution.partiallyRefund()).toThrow(InvalidContributionStateError);
  });

  it('throws InvalidContributionStateError from failed', () => {
    const contribution = Contribution.reconstitute({
      id: 'contrib-001',
      donorId: 'donor-001',
      campaignId: 'campaign-001',
      amountCents: 250099,
      status: 'failed',
      gatewayReference: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    expect(() => contribution.partiallyRefund()).toThrow(InvalidContributionStateError);
  });

  it('throws InvalidContributionStateError from partially_refunded', () => {
    const contribution = Contribution.reconstitute({
      id: 'contrib-001',
      donorId: 'donor-001',
      campaignId: 'campaign-001',
      amountCents: 250099,
      status: 'partially_refunded',
      gatewayReference: 'pi_existing',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    expect(() => contribution.partiallyRefund()).toThrow(InvalidContributionStateError);
  });

  it('throws InvalidContributionStateError from refunded', () => {
    const contribution = Contribution.reconstitute({
      id: 'contrib-001',
      donorId: 'donor-001',
      campaignId: 'campaign-001',
      amountCents: 250099,
      status: 'refunded',
      gatewayReference: 'pi_existing',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    expect(() => contribution.partiallyRefund()).toThrow(InvalidContributionStateError);
  });
});
