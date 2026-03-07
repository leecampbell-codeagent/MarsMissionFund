import { DomainError } from '../../../shared/domain/errors/DomainError';

export class RoleAssignmentForbiddenError extends DomainError {
  readonly code = 'ROLE_ASSIGNMENT_FORBIDDEN';

  constructor() {
    super('You do not have permission to assign this role.');
  }
}
