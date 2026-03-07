import { DomainError } from '../../../shared/domain/errors/DomainError';

export class InvalidRoleError extends DomainError {
  readonly code = 'INVALID_ROLE';

  constructor(role: string) {
    super(`'${role}' is not a valid role.`);
  }
}
