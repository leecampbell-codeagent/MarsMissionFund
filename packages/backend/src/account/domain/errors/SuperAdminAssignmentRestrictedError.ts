import { DomainError } from '../../../shared/domain/errors/DomainError';

export class SuperAdminAssignmentRestrictedError extends DomainError {
  readonly code = 'SUPER_ADMIN_ASSIGNMENT_RESTRICTED';

  constructor() {
    super('Super Administrator role cannot be assigned through this endpoint.');
  }
}
