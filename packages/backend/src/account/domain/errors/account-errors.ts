import { DomainError } from '../../../shared/domain/errors.js';

export class InvalidClerkUserIdError extends DomainError {
  readonly code = 'INVALID_CLERK_USER_ID';
  constructor() {
    super('INVALID_CLERK_USER_ID', 'Clerk user ID must be non-empty.');
  }
}

export class InvalidEmailError extends DomainError {
  readonly code = 'INVALID_EMAIL';
  constructor(_email?: string) {
    super('INVALID_EMAIL', 'The email address provided is invalid.');
  }
}

export class DisplayNameTooLongError extends DomainError {
  readonly code = 'DISPLAY_NAME_TOO_LONG';
  constructor() {
    super('DISPLAY_NAME_TOO_LONG', 'Display name must be 255 characters or fewer.');
  }
}

export class BioTooLongError extends DomainError {
  readonly code = 'BIO_TOO_LONG';
  constructor() {
    super('BIO_TOO_LONG', 'Bio must be 500 characters or fewer.');
  }
}

export class InvalidAvatarUrlError extends DomainError {
  readonly code = 'INVALID_AVATAR_URL';
  constructor(_url?: string) {
    super('INVALID_AVATAR_URL', 'The avatar URL provided is invalid.');
  }
}

export class AlreadyActiveError extends DomainError {
  readonly code = 'ALREADY_ACTIVE';
  constructor() {
    super('ALREADY_ACTIVE', 'User account is already active.');
  }
}

export class SuperAdminAssignmentForbiddenError extends DomainError {
  readonly code = 'SUPER_ADMIN_ASSIGNMENT_FORBIDDEN';
  constructor() {
    super(
      'SUPER_ADMIN_ASSIGNMENT_FORBIDDEN',
      'Super Administrator role cannot be assigned via this method.',
    );
  }
}

export class CannotRemoveBackerRoleError extends DomainError {
  readonly code = 'CANNOT_REMOVE_BACKER_ROLE';
  constructor() {
    super(
      'CANNOT_REMOVE_BACKER_ROLE',
      'Cannot remove the Backer role when it is the only assigned role.',
    );
  }
}

export class RoleNotAssignedError extends DomainError {
  readonly code = 'ROLE_NOT_ASSIGNED';
  constructor(_role?: string) {
    super('ROLE_NOT_ASSIGNED', 'The specified role is not assigned to this user.');
  }
}

export class SecurityAlertsCannotBeDisabledError extends DomainError {
  readonly code = 'SECURITY_ALERTS_MANDATORY';
  constructor() {
    super('SECURITY_ALERTS_MANDATORY', 'Security alerts are required and cannot be turned off.');
  }
}

export class UserNotFoundError extends DomainError {
  readonly code = 'USER_NOT_FOUND';
  constructor(_identifier?: string) {
    super('USER_NOT_FOUND', "We couldn't find your account. Try signing in again.");
  }
}

export class UserAlreadyExistsError extends DomainError {
  readonly code = 'USER_ALREADY_EXISTS';
  constructor(_clerkUserId?: string) {
    super('USER_ALREADY_EXISTS', 'A user account already exists for this identity.');
  }
}

export class AccountNotActiveError extends DomainError {
  readonly code = 'ACCOUNT_NOT_ACTIVE';
  constructor() {
    super(
      'ACCOUNT_NOT_ACTIVE',
      'Your account must be active to perform this action. Please verify your email.',
    );
  }
}

export class AccountSuspendedError extends DomainError {
  readonly code = 'ACCOUNT_SUSPENDED';
  constructor() {
    super(
      'ACCOUNT_SUSPENDED',
      'Your account has been suspended. Please contact support.',
    );
  }
}




























