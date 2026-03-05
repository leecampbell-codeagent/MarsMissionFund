export class DomainError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'DomainError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class AuthenticationError extends DomainError {
  constructor(message = 'Authentication required.') {
    super('UNAUTHENTICATED', message);
    this.name = 'AuthenticationError';
  }
}

export class AccountSuspendedError extends DomainError {
  constructor(message = 'Your account has been suspended. Please contact support.') {
    super('ACCOUNT_SUSPENDED', message);
    this.name = 'AccountSuspendedError';
  }
}

export class AccountDeletedError extends DomainError {
  constructor(message = 'This account has been deleted.') {
    super('ACCOUNT_DELETED', message);
    this.name = 'AccountDeletedError';
  }
}

export class InvalidAccountDataError extends DomainError {
  constructor(message: string) {
    super('INVALID_ACCOUNT_DATA', message);
    this.name = 'InvalidAccountDataError';
  }
}

export class InvalidOnboardingStepError extends DomainError {
  constructor(message: string) {
    super('INVALID_ONBOARDING_STEP', message);
    this.name = 'InvalidOnboardingStepError';
  }
}

export class AccountNotFoundError extends DomainError {
  constructor(message = 'Account not found.') {
    super('ACCOUNT_NOT_FOUND', message);
    this.name = 'AccountNotFoundError';
  }
}
