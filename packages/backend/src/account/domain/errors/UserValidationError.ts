import { DomainError } from '../../../shared/domain/errors/DomainError';

export class UserValidationError extends DomainError {
  readonly code = 'USER_VALIDATION_ERROR';
}
