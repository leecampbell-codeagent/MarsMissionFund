import { describe, expect, it } from 'vitest';
import { Result } from './Result';

describe('Result', () => {
  it('ok() creates a successful result with a value', () => {
    const result = Result.ok(42);
    expect(result.isSuccess).toBe(true);
    expect(result.isFailure).toBe(false);
    expect(result.value).toBe(42);
    expect(result.error).toBeUndefined();
  });

  it('fail() creates a failed result with an error', () => {
    const error = new Error('something went wrong');
    const result = Result.fail<number>(error);
    expect(result.isSuccess).toBe(false);
    expect(result.isFailure).toBe(true);
    expect(result.error).toBe(error);
  });

  it('throws when accessing value on a failed result', () => {
    const result = Result.fail<string>(new Error('boom'));
    expect(() => result.value).toThrow('Cannot access value of a failed Result');
  });
});
