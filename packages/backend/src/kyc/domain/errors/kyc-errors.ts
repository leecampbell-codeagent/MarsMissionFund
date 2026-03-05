import { DomainError } from '../../../shared/domain/errors.js';

export class KycAlreadyPendingError extends DomainError {
  readonly code = 'KYC_ALREADY_PENDING';
  constructor() {
    super('KYC_ALREADY_PENDING', 'Your identity verification is already in progress.');
  }
}

export class KycAlreadyVerifiedError extends DomainError {
  readonly code = 'KYC_ALREADY_VERIFIED';
  constructor() {
    super('KYC_ALREADY_VERIFIED', 'Your identity has already been verified.');
  }
}

export class KycResubmissionNotAllowedError extends DomainError {
  readonly code = 'KYC_RESUBMISSION_NOT_ALLOWED';
  constructor() {
    super(
      'KYC_RESUBMISSION_NOT_ALLOWED',
      'Resubmission is not available for your current verification status.',
    );
  }
}

export class KycAccountNotActiveError extends DomainError {
  readonly code = 'ACCOUNT_NOT_ACTIVE';
  constructor() {
    super(
      'ACCOUNT_NOT_ACTIVE',
      'Your account must be active before you can complete identity verification. Please verify your email first.',
    );
  }
}

export class KycAccountSuspendedError extends DomainError {
  readonly code = 'ACCOUNT_SUSPENDED';
  constructor() {
    super(
      'ACCOUNT_SUSPENDED',
      'Your account has been suspended. Identity verification is unavailable.',
    );
  }
}

export class KycTransitionConflictError extends DomainError {
  readonly code = 'KYC_TRANSITION_CONFLICT';
  constructor() {
    super(
      'KYC_TRANSITION_CONFLICT',
      'Your verification status changed while processing. Please refresh and try again.',
    );
  }
}
