import { DomainError } from '../../shared/domain/errors.js';

export class KycVerificationNotFoundError extends DomainError {
  constructor(message = 'KYC verification not found.') {
    super('KYC_NOT_FOUND', message);
    this.name = 'KycVerificationNotFoundError';
  }
}

export class InvalidKycTransitionError extends DomainError {
  constructor(from: string, to: string) {
    super('INVALID_KYC_TRANSITION', `Cannot transition KYC status from '${from}' to '${to}'.`);
    this.name = 'InvalidKycTransitionError';
  }
}

export class KycLockedError extends DomainError {
  constructor(message = 'KYC verification is locked due to too many failures. Admin unlock required.') {
    super('KYC_LOCKED', message);
    this.name = 'KycLockedError';
  }
}

export class KycAlreadyVerifiedError extends DomainError {
  constructor(message = 'KYC verification is already verified.') {
    super('KYC_ALREADY_VERIFIED', message);
    this.name = 'KycAlreadyVerifiedError';
  }
}

export class InsufficientRoleError extends DomainError {
  constructor(message = 'Insufficient permissions for this action.') {
    super('INSUFFICIENT_ROLE', message);
    this.name = 'InsufficientRoleError';
  }
}
