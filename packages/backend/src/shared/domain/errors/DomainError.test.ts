import { describe, expect, it } from 'vitest';
import { DomainError } from './DomainError';

class TestError extends DomainError {
  readonly code = 'TEST_ERROR';
}

describe('DomainError', () => {
  it('sets the error code on a concrete subclass', () => {
    const error = new TestError('something went wrong');
    expect(error.code).toBe('TEST_ERROR');
    expect(error.message).toBe('something went wrong');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(DomainError);
  });

  it('sets the name to the subclass constructor name', () => {
    const error = new TestError('msg');
    expect(error.name).toBe('TestError');
  });
});
