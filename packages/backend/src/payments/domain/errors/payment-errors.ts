import { DomainError } from '../../../shared/domain/errors.js';

export class ContributionAmountBelowMinimumError extends DomainError {
  readonly code = 'CONTRIBUTION_AMOUNT_BELOW_MINIMUM';
  constructor(amountCents: number) {
    super(
      'CONTRIBUTION_AMOUNT_BELOW_MINIMUM',
      `Minimum contribution is $5.00. You submitted ${amountCents} cents.`,
    );
  }
}

export class InvalidContributionAmountError extends DomainError {
  readonly code = 'INVALID_CONTRIBUTION_AMOUNT';
  constructor() {
    super('INVALID_CONTRIBUTION_AMOUNT', 'Contribution amount must be a positive integer (cents).');
  }
}

export class InvalidContributionDonorIdError extends DomainError {
  readonly code = 'INVALID_CONTRIBUTION_DONOR_ID';
  constructor() {
    super('INVALID_CONTRIBUTION_DONOR_ID', 'Donor user ID is required.');
  }
}

export class InvalidContributionCampaignIdError extends DomainError {
  readonly code = 'INVALID_CONTRIBUTION_CAMPAIGN_ID';
  constructor() {
    super('INVALID_CONTRIBUTION_CAMPAIGN_ID', 'Campaign ID is required.');
  }
}

export class CampaignNotAcceptingContributionsError extends DomainError {
  readonly code = 'CAMPAIGN_NOT_ACCEPTING_CONTRIBUTIONS';
  constructor(status: string) {
    super(
      'CAMPAIGN_NOT_ACCEPTING_CONTRIBUTIONS',
      `This campaign is not accepting contributions (status: ${status}).`,
    );
  }
}

export class DuplicateContributionError extends DomainError {
  readonly code = 'DUPLICATE_CONTRIBUTION';
  constructor() {
    super(
      'DUPLICATE_CONTRIBUTION',
      'An identical contribution was submitted within the last 60 seconds. Please wait before trying again.',
    );
  }
}

export class ContributionNotFoundError extends DomainError {
  readonly code = 'CONTRIBUTION_NOT_FOUND';
  constructor() {
    super('CONTRIBUTION_NOT_FOUND', 'Contribution not found.');
  }
}

export class PaymentCaptureError extends DomainError {
  readonly code = 'PAYMENT_CAPTURE_FAILED';
  constructor(reason: string) {
    super('PAYMENT_CAPTURE_FAILED', reason);
  }
}
