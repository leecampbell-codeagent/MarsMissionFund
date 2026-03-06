import { DomainError } from '../../shared/domain/errors.js';

export class AccountSuspendedError extends DomainError {
  readonly code = 'ACCOUNT_SUSPENDED' as const;

  constructor() {
    super('ACCOUNT_SUSPENDED', 'Your account has been suspended.');
  }
}

export class AccountDeactivatedError extends DomainError {
  readonly code = 'ACCOUNT_DEACTIVATED' as const;

  constructor() {
    super('ACCOUNT_DEACTIVATED', 'Your account has been deactivated.');
  }
}

export class AccountDeletedError extends DomainError {
  readonly code = 'ACCOUNT_DELETED' as const;

  constructor() {
    super('ACCOUNT_DELETED', 'This account no longer exists.');
  }
}

export class AccountPendingError extends DomainError {
  readonly code = 'ACCOUNT_PENDING' as const;

  constructor() {
    super('ACCOUNT_PENDING', 'Account verification required.');
  }
}
