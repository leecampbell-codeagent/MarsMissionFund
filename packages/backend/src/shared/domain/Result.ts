export class Result<T> {
  readonly isSuccess: boolean;
  readonly isFailure: boolean;
  readonly error: Error | undefined;
  private readonly _value: T | undefined;

  private constructor(isSuccess: boolean, error?: Error, value?: T) {
    this.isSuccess = isSuccess;
    this.isFailure = !isSuccess;
    this.error = error;
    this._value = value;
  }

  get value(): T {
    if (!this.isSuccess) {
      throw new Error('Cannot access value of a failed Result');
    }
    return this._value as T;
  }

  static ok<T>(value: T): Result<T> {
    return new Result<T>(true, undefined, value);
  }

  static fail<T>(error: Error): Result<T> {
    return new Result<T>(false, error, undefined);
  }
}
