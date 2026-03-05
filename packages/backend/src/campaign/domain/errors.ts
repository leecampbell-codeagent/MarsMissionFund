import { DomainError } from '../../shared/domain/errors.js';

export class InvalidCampaignError extends DomainError {
  constructor(message: string) {
    super('INVALID_CAMPAIGN_DATA', message);
    this.name = 'InvalidCampaignError';
  }
}

export class CampaignNotFoundError extends DomainError {
  constructor(message = 'Campaign not found.') {
    super('CAMPAIGN_NOT_FOUND', message);
    this.name = 'CampaignNotFoundError';
  }
}

export class CampaignAlreadySubmittedError extends DomainError {
  constructor(message = 'Campaign has already been submitted and cannot be modified.') {
    super('CAMPAIGN_ALREADY_SUBMITTED', message);
    this.name = 'CampaignAlreadySubmittedError';
  }
}

export class KycRequiredError extends DomainError {
  constructor(message = 'Identity verification is required before submitting a campaign.') {
    super('KYC_REQUIRED', message);
    this.name = 'KycRequiredError';
  }
}

export class InsufficientRoleError extends DomainError {
  constructor(message = 'You do not have the required role to perform this action.') {
    super('INSUFFICIENT_ROLE', message);
    this.name = 'InsufficientRoleError';
  }
}

export class CampaignNotReviewableError extends DomainError {
  constructor(message = 'Campaign is not in a reviewable state for this action.') {
    super('CAMPAIGN_NOT_REVIEWABLE', message);
    this.name = 'CampaignNotReviewableError';
  }
}

export class ReviewerCommentRequiredError extends DomainError {
  constructor(message = 'A written comment is required for this review action.') {
    super('REVIEWER_COMMENT_REQUIRED', message);
    this.name = 'ReviewerCommentRequiredError';
  }
}
