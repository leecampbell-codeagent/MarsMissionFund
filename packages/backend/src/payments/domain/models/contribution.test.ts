import { describe, expect, it } from 'vitest';
import {
  ContributionAmountBelowMinimumError,
  InvalidContributionAmountError,
  InvalidContributionCampaignIdError,
  InvalidContributionDonorIdError,
} from '../errors/payment-errors.js';
import { ContributionStatus } from '../value-objects/contribution-status.js';
import { Contribution, MINIMUM_CONTRIBUTION_CENTS } from './contribution.js';

const validCreateInput = {
  donorUserId: crypto.randomUUID(),
  campaignId: crypto.randomUUID(),
  amountCents: 1000,
  paymentToken: 'tok_test_abc123',
};

describe('Contribution entity', () => {
  describe('create()', () => {
    it('creates a valid contribution in pending_capture status', () => {
      const contribution = Contribution.create(validCreateInput);

      expect(contribution.donorUserId).toBe(validCreateInput.donorUserId);
      expect(contribution.campaignId).toBe(validCreateInput.campaignId);
      expect(contribution.amountCents).toBe(1000);
      expect(contribution.paymentToken).toBe('tok_test_abc123');
      expect(contribution.status).toBe(ContributionStatus.PendingCapture);
      expect(contribution.transactionRef).toBeNull();
      expect(contribution.failureReason).toBeNull();
      expect(contribution.idempotencyKey).toBeNull();
      expect(contribution.id).toBe(''); // Set by DB on insert
    });

    it('accepts minimum contribution amount of 500 cents', () => {
      const contribution = Contribution.create({
        ...validCreateInput,
        amountCents: MINIMUM_CONTRIBUTION_CENTS,
      });
      expect(contribution.amountCents).toBe(500);
    });

    it('throws ContributionAmountBelowMinimumError for amount below 500 cents', () => {
      expect(() => Contribution.create({ ...validCreateInput, amountCents: 499 })).toThrow(
        ContributionAmountBelowMinimumError,
      );
    });

    it('throws ContributionAmountBelowMinimumError for 1 cent', () => {
      expect(() => Contribution.create({ ...validCreateInput, amountCents: 1 })).toThrow(
        ContributionAmountBelowMinimumError,
      );
    });

    it('throws InvalidContributionAmountError for zero amount', () => {
      expect(() => Contribution.create({ ...validCreateInput, amountCents: 0 })).toThrow(
        InvalidContributionAmountError,
      );
    });

    it('throws InvalidContributionAmountError for negative amount', () => {
      expect(() => Contribution.create({ ...validCreateInput, amountCents: -100 })).toThrow(
        InvalidContributionAmountError,
      );
    });

    it('throws InvalidContributionAmountError for non-integer amount', () => {
      expect(() => Contribution.create({ ...validCreateInput, amountCents: 10.5 })).toThrow(
        InvalidContributionAmountError,
      );
    });

    it('throws InvalidContributionDonorIdError for empty donorUserId', () => {
      expect(() => Contribution.create({ ...validCreateInput, donorUserId: '' })).toThrow(
        InvalidContributionDonorIdError,
      );
    });

    it('throws InvalidContributionDonorIdError for whitespace donorUserId', () => {
      expect(() => Contribution.create({ ...validCreateInput, donorUserId: '   ' })).toThrow(
        InvalidContributionDonorIdError,
      );
    });

    it('throws InvalidContributionCampaignIdError for empty campaignId', () => {
      expect(() => Contribution.create({ ...validCreateInput, campaignId: '' })).toThrow(
        InvalidContributionCampaignIdError,
      );
    });

    it('stores optional idempotencyKey when provided', () => {
      const key = 'idem-key-123';
      const contribution = Contribution.create({
        ...validCreateInput,
        idempotencyKey: key,
      });
      expect(contribution.idempotencyKey).toBe(key);
    });
  });

  describe('reconstitute()', () => {
    it('reconstitutes a contribution without validation', () => {
      const now = new Date();
      const contribution = Contribution.reconstitute({
        id: crypto.randomUUID(),
        donorUserId: crypto.randomUUID(),
        campaignId: crypto.randomUUID(),
        amountCents: 100, // Below minimum — but reconstitute() skips validation
        paymentToken: 'tok_xyz',
        status: ContributionStatus.Captured,
        transactionRef: 'stub_txn_123',
        failureReason: null,
        idempotencyKey: null,
        createdAt: now,
        updatedAt: now,
      });

      expect(contribution.amountCents).toBe(100);
      expect(contribution.status).toBe(ContributionStatus.Captured);
      expect(contribution.transactionRef).toBe('stub_txn_123');
    });
  });

  describe('capture()', () => {
    it('returns a new Contribution in captured status with transactionRef', () => {
      const pending = Contribution.create(validCreateInput);
      const captured = pending.capture('stub_txn_abc_123');

      expect(captured.status).toBe(ContributionStatus.Captured);
      expect(captured.transactionRef).toBe('stub_txn_abc_123');
      expect(captured.failureReason).toBeNull();

      // Original is unchanged (immutability)
      expect(pending.status).toBe(ContributionStatus.PendingCapture);
    });

    it('preserves original properties on capture', () => {
      const pending = Contribution.create(validCreateInput);
      const captured = pending.capture('stub_txn_abc');

      expect(captured.donorUserId).toBe(pending.donorUserId);
      expect(captured.campaignId).toBe(pending.campaignId);
      expect(captured.amountCents).toBe(pending.amountCents);
    });
  });

  describe('fail()', () => {
    it('returns a new Contribution in failed status with failureReason', () => {
      const pending = Contribution.create(validCreateInput);
      const failed = pending.fail('Card declined');

      expect(failed.status).toBe(ContributionStatus.Failed);
      expect(failed.failureReason).toBe('Card declined');
      expect(failed.transactionRef).toBeNull();

      // Original is unchanged (immutability)
      expect(pending.status).toBe(ContributionStatus.PendingCapture);
    });

    it('preserves original properties on fail', () => {
      const pending = Contribution.create(validCreateInput);
      const failed = pending.fail('Insufficient funds');

      expect(failed.donorUserId).toBe(pending.donorUserId);
      expect(failed.campaignId).toBe(pending.campaignId);
      expect(failed.amountCents).toBe(pending.amountCents);
    });
  });
});
