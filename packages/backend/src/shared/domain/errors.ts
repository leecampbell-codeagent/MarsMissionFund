export abstract class DomainError extends Error {
  abstract readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = code;
    // Fix prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
