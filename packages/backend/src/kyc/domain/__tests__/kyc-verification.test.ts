import { describe, expect, it } from 'vitest';
import { KycVerification } from '../kyc-verification.js';
import {
  InvalidKycTransitionError,
  KycAlreadyVerifiedError,
  KycLockedError,
} from '../errors.js';

const ACCOUNT_ID = 'acc-test-001';

function makeVerification(overrides: Partial<Parameters<typeof KycVerification.reconstitute>[0]> = {}) {
  return KycVerification.reconstitute({
    id: 'kyc-001',
    accountId: ACCOUNT_ID,
    status: 'not_verified',
    documentType: null,
    providerReference: null,
    frontDocumentRef: null,
    backDocumentRef: null,
    failureCount: 0,
    verifiedAt: null,
    expiresAt: null,
    submittedAt: null,
    createdAt: new Date('2026-03-05T00:00:00Z'),
    updatedAt: new Date('2026-03-05T00:00:00Z'),
    ...overrides,
  });
}

describe('KycVerification.create', () => {
  it('creates a new verification with not_verified status', () => {
    const v = KycVerification.create({ accountId: ACCOUNT_ID });
    expect(v.id).toBeDefined();
    expect(v.accountId).toBe(ACCOUNT_ID);
    expect(v.status).toBe('not_verified');
    expect(v.failureCount).toBe(0);
    expect(v.documentType).toBeNull();
    expect(v.verifiedAt).toBeNull();
  });
});

describe('KycVerification.submit', () => {
  it('transitions not_verified -> pending', () => {
    const v = makeVerification({ status: 'not_verified' });
    const submitted = v.submit({ documentType: 'passport' });
    expect(submitted.status).toBe('pending');
    expect(submitted.documentType).toBe('passport');
    expect(submitted.submittedAt).toBeInstanceOf(Date);
  });

  it('transitions pending_resubmission -> pending', () => {
    const v = makeVerification({ status: 'pending_resubmission' });
    const submitted = v.submit({ documentType: 'national_id' });
    expect(submitted.status).toBe('pending');
    expect(submitted.documentType).toBe('national_id');
  });

  it('stores front and back document refs', () => {
    const v = makeVerification({ status: 'not_verified' });
    const submitted = v.submit({
      documentType: 'drivers_licence',
      frontDocumentRef: 'mock://docs/front-001',
      backDocumentRef: 'mock://docs/back-001',
    });
    expect(submitted.frontDocumentRef).toBe('mock://docs/front-001');
    expect(submitted.backDocumentRef).toBe('mock://docs/back-001');
  });

  it('throws KycLockedError when locked', () => {
    const v = makeVerification({ status: 'locked' });
    expect(() => v.submit({ documentType: 'passport' })).toThrow(KycLockedError);
  });

  it('throws KycAlreadyVerifiedError when already verified', () => {
    const v = makeVerification({ status: 'verified', verifiedAt: new Date() });
    expect(() => v.submit({ documentType: 'passport' })).toThrow(KycAlreadyVerifiedError);
  });

  it('throws InvalidKycTransitionError for invalid state (in_manual_review -> pending)', () => {
    const v = makeVerification({ status: 'in_manual_review' });
    expect(() => v.submit({ documentType: 'passport' })).toThrow(InvalidKycTransitionError);
  });
});

describe('KycVerification.approve', () => {
  it('transitions pending -> verified', () => {
    const v = makeVerification({ status: 'pending' });
    const approved = v.approve('session-ref-001');
    expect(approved.status).toBe('verified');
    expect(approved.providerReference).toBe('session-ref-001');
    expect(approved.verifiedAt).toBeInstanceOf(Date);
  });

  it('transitions in_manual_review -> verified', () => {
    const v = makeVerification({ status: 'in_manual_review' });
    const approved = v.approve();
    expect(approved.status).toBe('verified');
  });

  it('throws on invalid transition (not_verified -> verified)', () => {
    const v = makeVerification({ status: 'not_verified' });
    expect(() => v.approve()).toThrow(InvalidKycTransitionError);
  });
});

describe('KycVerification.requestResubmission', () => {
  it('transitions pending -> pending_resubmission and increments failure count', () => {
    const v = makeVerification({ status: 'pending', failureCount: 0 });
    const result = v.requestResubmission();
    expect(result.status).toBe('pending_resubmission');
    expect(result.failureCount).toBe(1);
  });

  it('auto-locks after 5 failures', () => {
    const v = makeVerification({ status: 'pending', failureCount: 4 });
    const result = v.requestResubmission();
    expect(result.status).toBe('locked');
    expect(result.failureCount).toBe(5);
  });

  it('auto-locks after more than 5 failures', () => {
    const v = makeVerification({ status: 'pending', failureCount: 10 });
    const result = v.requestResubmission();
    expect(result.status).toBe('locked');
  });

  it('transitions in_manual_review -> pending_resubmission', () => {
    const v = makeVerification({ status: 'in_manual_review', failureCount: 1 });
    const result = v.requestResubmission();
    expect(result.status).toBe('pending_resubmission');
  });

  it('throws on invalid transition (not_verified -> pending_resubmission)', () => {
    const v = makeVerification({ status: 'not_verified' });
    expect(() => v.requestResubmission()).toThrow(InvalidKycTransitionError);
  });
});

describe('KycVerification.sendToManualReview', () => {
  it('transitions pending -> in_manual_review', () => {
    const v = makeVerification({ status: 'pending' });
    const result = v.sendToManualReview();
    expect(result.status).toBe('in_manual_review');
  });

  it('throws on invalid transition (not_verified -> in_manual_review)', () => {
    const v = makeVerification({ status: 'not_verified' });
    expect(() => v.sendToManualReview()).toThrow(InvalidKycTransitionError);
  });
});

describe('KycVerification.reject', () => {
  it('transitions pending -> rejected and increments failure count', () => {
    const v = makeVerification({ status: 'pending', failureCount: 0 });
    const result = v.reject();
    expect(result.status).toBe('rejected');
    expect(result.failureCount).toBe(1);
  });

  it('throws on invalid transition (verified -> rejected)', () => {
    const v = makeVerification({ status: 'verified', verifiedAt: new Date() });
    expect(() => v.reject()).toThrow(InvalidKycTransitionError);
  });
});

describe('KycVerification.adminUnlock', () => {
  it('transitions locked -> pending_resubmission', () => {
    const v = makeVerification({ status: 'locked', failureCount: 5 });
    const result = v.adminUnlock();
    expect(result.status).toBe('pending_resubmission');
  });

  it('throws InvalidKycTransitionError if not locked', () => {
    const v = makeVerification({ status: 'pending' });
    expect(() => v.adminUnlock()).toThrow(InvalidKycTransitionError);
  });
});

describe('KycVerification.requestReverification', () => {
  it('transitions verified -> reverification_required', () => {
    const v = makeVerification({ status: 'verified', verifiedAt: new Date() });
    const result = v.requestReverification();
    expect(result.status).toBe('reverification_required');
  });

  it('throws on invalid transition (pending -> reverification_required)', () => {
    const v = makeVerification({ status: 'pending' });
    expect(() => v.requestReverification()).toThrow(InvalidKycTransitionError);
  });
});

describe('KycVerification computed state', () => {
  it('isVerified returns true for verified status', () => {
    const v = makeVerification({ status: 'verified', verifiedAt: new Date() });
    expect(v.isVerified()).toBe(true);
  });

  it('isVerified returns false for other statuses', () => {
    expect(makeVerification({ status: 'not_verified' }).isVerified()).toBe(false);
    expect(makeVerification({ status: 'pending' }).isVerified()).toBe(false);
    expect(makeVerification({ status: 'locked' }).isVerified()).toBe(false);
  });

  it('isLocked returns true for locked status', () => {
    const v = makeVerification({ status: 'locked' });
    expect(v.isLocked()).toBe(true);
  });

  it('canSubmit returns true for submittable states', () => {
    expect(makeVerification({ status: 'not_verified' }).canSubmit()).toBe(true);
    expect(makeVerification({ status: 'pending_resubmission' }).canSubmit()).toBe(true);
    expect(makeVerification({ status: 'expired' }).canSubmit()).toBe(true);
    expect(makeVerification({ status: 'reverification_required' }).canSubmit()).toBe(true);
  });

  it('canSubmit returns false for non-submittable states', () => {
    expect(makeVerification({ status: 'pending' }).canSubmit()).toBe(false);
    expect(makeVerification({ status: 'verified', verifiedAt: new Date() }).canSubmit()).toBe(false);
    expect(makeVerification({ status: 'locked' }).canSubmit()).toBe(false);
  });
});
