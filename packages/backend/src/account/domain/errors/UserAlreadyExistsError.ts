import { DomainError } from '../../../shared/domain/errors/DomainError';

export class UserAlreadyExistsError extends DomainError {
  readonly code = 'USER_ALREADY_EXISTS';

  constructor() {
    super('A user with this identity already exists.');
  }
}
