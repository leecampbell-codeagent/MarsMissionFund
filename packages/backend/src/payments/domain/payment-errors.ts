import { DomainError } from '../../shared/domain/errors.js';

export class InvalidContributionAmountError extends DomainError {
  constructor(message = 'Contribution amount must be at least 100 cents ($1.00).') {
    super('INVALID_AMOUNT', message);
    this.name = 'InvalidContributionAmountError';
  }
}

export class InvalidContributionDataError extends DomainError {
  constructor(message: string) {
    super('INVALID_CONTRIBUTION_DATA', message);
    this.name = 'InvalidContributionDataError';
  }
}

export class InvalidContributionStateError extends DomainError {
  constructor(fromState: string, toState: string) {
    super(
      'INVALID_CONTRIBUTION_STATE',
      `Cannot transition contribution from '${fromState}' to '${toState}'.`,
    );
    this.name = 'InvalidContributionStateError';
  }
}

export class ContributionNotFoundError extends DomainError {
  constructor() {
    super('CONTRIBUTION_NOT_FOUND', 'Contribution not found.');
    this.name = 'ContributionNotFoundError';
  }
}

export class InvalidEscrowEntryError extends DomainError {
  constructor(message: string) {
    super('INVALID_ESCROW_ENTRY', message);
    this.name = 'InvalidEscrowEntryError';
  }
}

export class PaymentGatewayError extends DomainError {
  readonly gatewayCode: string | undefined;

  constructor(code: string, message: string, gatewayCode?: string) {
    super(code, message);
    this.name = 'PaymentGatewayError';
    this.gatewayCode = gatewayCode;
  }
}

export class CardDeclinedError extends PaymentGatewayError {
  constructor(message = 'Your card was declined. Please check your details and try again.') {
    super('CARD_DECLINED', message, 'card_declined');
    this.name = 'CardDeclinedError';
  }
}

export class InsufficientFundsError extends PaymentGatewayError {
  constructor(message = 'Insufficient funds. Please use a different payment method.') {
    super('INSUFFICIENT_FUNDS', message, 'insufficient_funds');
    this.name = 'InsufficientFundsError';
  }
}

export class InvalidWebhookSignatureError extends DomainError {
  constructor() {
    super('INVALID_WEBHOOK_SIGNATURE', 'Webhook signature verification failed.');
    this.name = 'InvalidWebhookSignatureError';
  }
}
