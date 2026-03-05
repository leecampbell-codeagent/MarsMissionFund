import {
  InvalidKycTransitionError,
  KycAlreadyVerifiedError,
  KycLockedError,
} from './errors.js';

export type KycStatus =
  | 'not_verified'
  | 'pending'
  | 'pending_resubmission'
  | 'in_manual_review'
  | 'verified'
  | 'rejected'
  | 'locked'
  | 'expired'
  | 'reverification_required';

export type DocumentType = 'passport' | 'national_id' | 'drivers_licence';

/** Maximum failure count before account is locked */
export const MAX_KYC_FAILURES = 5;

/**
 * Valid transitions: from -> set of allowed to states
 */
const ALLOWED_TRANSITIONS: Readonly<Record<KycStatus, readonly KycStatus[]>> = {
  not_verified: ['pending'],
  pending: ['pending_resubmission', 'in_manual_review', 'verified', 'rejected'],
  pending_resubmission: ['pending'],
  in_manual_review: ['verified', 'rejected', 'pending_resubmission'],
  verified: ['reverification_required'],
  rejected: ['locked'],
  locked: ['pending'], // only via admin unlock
  expired: ['pending'],
  reverification_required: ['pending'],
};

interface KycVerificationProps {
  readonly id: string;
  readonly accountId: string;
  readonly status: KycStatus;
  readonly documentType: DocumentType | null;
  readonly providerReference: string | null;
  readonly frontDocumentRef: string | null;
  readonly backDocumentRef: string | null;
  readonly failureCount: number;
  readonly verifiedAt: Date | null;
  readonly expiresAt: Date | null;
  readonly submittedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateKycVerificationInput {
  readonly accountId: string;
}

export interface SubmitKycInput {
  readonly documentType: DocumentType;
  readonly frontDocumentRef?: string | null;
  readonly backDocumentRef?: string | null;
}

export class KycVerification {
  private constructor(private readonly props: KycVerificationProps) {}

  /** Creates a new KYC verification record for an account (starts as not_verified). */
  static create(input: CreateKycVerificationInput): KycVerification {
    return new KycVerification({
      id: crypto.randomUUID(),
      accountId: input.accountId,
      status: 'not_verified',
      documentType: null,
      providerReference: null,
      frontDocumentRef: null,
      backDocumentRef: null,
      failureCount: 0,
      verifiedAt: null,
      expiresAt: null,
      submittedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  /** Reconstitutes from persistence — no validation (data is already valid). */
  static reconstitute(props: KycVerificationProps): KycVerification {
    return new KycVerification(props);
  }

  get id(): string { return this.props.id; }
  get accountId(): string { return this.props.accountId; }
  get status(): KycStatus { return this.props.status; }
  get documentType(): DocumentType | null { return this.props.documentType; }
  get providerReference(): string | null { return this.props.providerReference; }
  get frontDocumentRef(): string | null { return this.props.frontDocumentRef; }
  get backDocumentRef(): string | null { return this.props.backDocumentRef; }
  get failureCount(): number { return this.props.failureCount; }
  get verifiedAt(): Date | null { return this.props.verifiedAt; }
  get expiresAt(): Date | null { return this.props.expiresAt; }
  get submittedAt(): Date | null { return this.props.submittedAt; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  isVerified(): boolean {
    return this.props.status === 'verified';
  }

  isLocked(): boolean {
    return this.props.status === 'locked';
  }

  canSubmit(): boolean {
    return (
      this.props.status === 'not_verified' ||
      this.props.status === 'pending_resubmission' ||
      this.props.status === 'expired' ||
      this.props.status === 'reverification_required'
    );
  }

  /** Transitions to 'pending' when a verification is submitted. */
  submit(input: SubmitKycInput): KycVerification {
    if (this.props.status === 'locked') {
      throw new KycLockedError();
    }
    if (this.props.status === 'verified') {
      throw new KycAlreadyVerifiedError();
    }
    this.assertTransition('pending');

    return new KycVerification({
      ...this.props,
      status: 'pending',
      documentType: input.documentType,
      frontDocumentRef: input.frontDocumentRef ?? null,
      backDocumentRef: input.backDocumentRef ?? null,
      submittedAt: new Date(),
      providerReference: null,
      updatedAt: new Date(),
    });
  }

  /** Transitions to 'verified'. */
  approve(providerReference?: string): KycVerification {
    this.assertTransition('verified');
    return new KycVerification({
      ...this.props,
      status: 'verified',
      providerReference: providerReference ?? this.props.providerReference,
      verifiedAt: new Date(),
      updatedAt: new Date(),
    });
  }

  /** Transitions to 'pending_resubmission' and increments failure count. */
  requestResubmission(): KycVerification {
    this.assertTransition('pending_resubmission');
    const newFailureCount = this.props.failureCount + 1;

    // Auto-lock after MAX_KYC_FAILURES
    if (newFailureCount >= MAX_KYC_FAILURES) {
      return new KycVerification({
        ...this.props,
        status: 'locked',
        failureCount: newFailureCount,
        updatedAt: new Date(),
      });
    }

    return new KycVerification({
      ...this.props,
      status: 'pending_resubmission',
      failureCount: newFailureCount,
      updatedAt: new Date(),
    });
  }

  /** Transitions to 'in_manual_review'. */
  sendToManualReview(): KycVerification {
    this.assertTransition('in_manual_review');
    return new KycVerification({
      ...this.props,
      status: 'in_manual_review',
      updatedAt: new Date(),
    });
  }

  /** Transitions to 'rejected' and increments failure count. */
  reject(): KycVerification {
    this.assertTransition('rejected');
    const newFailureCount = this.props.failureCount + 1;
    return new KycVerification({
      ...this.props,
      status: 'rejected',
      failureCount: newFailureCount,
      updatedAt: new Date(),
    });
  }

  /** Transitions locked -> pending (admin unlock). */
  adminUnlock(): KycVerification {
    if (this.props.status !== 'locked') {
      throw new InvalidKycTransitionError(this.props.status, 'pending (unlock)');
    }
    return new KycVerification({
      ...this.props,
      status: 'pending_resubmission',
      updatedAt: new Date(),
    });
  }

  /** Transitions verified -> reverification_required. */
  requestReverification(): KycVerification {
    this.assertTransition('reverification_required');
    return new KycVerification({
      ...this.props,
      status: 'reverification_required',
      updatedAt: new Date(),
    });
  }

  private assertTransition(to: KycStatus): void {
    const allowed = ALLOWED_TRANSITIONS[this.props.status];
    if (!allowed.includes(to)) {
      throw new InvalidKycTransitionError(this.props.status, to);
    }
  }
}
