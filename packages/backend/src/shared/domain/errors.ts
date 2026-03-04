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
  constructor(message: string = 'Authentication required.') {
    super('UNAUTHENTICATED', message);
    this.name = 'AuthenticationError';
  }
}

export class AccountSuspendedError extends DomainError {
  constructor(message: string = 'Your account has been suspended. Please contact support.') {
    super('ACCOUNT_SUSPENDED', message);
    this.name = 'AccountSuspendedError';
  }
}

export class AccountDeletedError extends DomainError {
  constructor(message: string = 'This account has been deleted.') {
    super('ACCOUNT_DELETED', message);
    this.name = 'AccountDeletedError';
  }
}
