import { describe, expect, it } from 'vitest';
import { DomainError } from '../../../shared/domain/errors/DomainError';
import { UserAlreadyExistsError } from './UserAlreadyExistsError';

describe('UserAlreadyExistsError', () => {
  it('has code USER_ALREADY_EXISTS and extends DomainError', () => {
    const error = new UserAlreadyExistsError();
    expect(error.code).toBe('USER_ALREADY_EXISTS');
    expect(error).toBeInstanceOf(DomainError);
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBeTruthy();
  });
});
