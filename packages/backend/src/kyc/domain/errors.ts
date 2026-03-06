import { DomainError } from '../../shared/domain/errors.js';

export class KycRequiredError extends DomainError {
  readonly code = 'KYC_REQUIRED' as const;

  constructor() {
    super('KYC_REQUIRED', 'Identity verification is required to access this feature.');
  }
}

export class AlreadyVerifiedError extends DomainError {
  readonly code = 'ALREADY_VERIFIED' as const;

  constructor() {
    super('ALREADY_VERIFIED', 'Identity verification is already complete.');
  }
}
