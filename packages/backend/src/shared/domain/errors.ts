export abstract class DomainError extends Error {
  abstract readonly code: string;

  constructor(_code: string, message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
