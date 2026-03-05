import { DomainError } from '../../../shared/domain/errors.js';

export class CreatorRoleRequiredError extends DomainError {
  readonly code = 'CREATOR_ROLE_REQUIRED';
  constructor() {
    super(
      'CREATOR_ROLE_REQUIRED',
      'You need the Creator role to perform this action. Designate yourself as a creator first.',
    );
  }
}

export class KycNotVerifiedError extends DomainError {
  readonly code = 'KYC_NOT_VERIFIED';
  constructor() {
    super(
      'KYC_NOT_VERIFIED',
      'Identity verification is required. Complete your KYC verification to continue.',
    );
  }
}

export class AccountNotActiveError extends DomainError {
  readonly code = 'ACCOUNT_NOT_ACTIVE';
  constructor() {
    super(
      'ACCOUNT_NOT_ACTIVE',
      'Your account must be active to perform this action. Please verify your email.',
    );
  }
}

export class AccountSuspendedError extends DomainError {
  readonly code = 'ACCOUNT_SUSPENDED';
  constructor() {
    super(
      'ACCOUNT_SUSPENDED',
      'Your account has been suspended. Please contact support.',
    );
  }
}

export class InvalidCampaignTitleError extends DomainError {
  readonly code = 'INVALID_CAMPAIGN_TITLE';
  constructor() {
    super('INVALID_CAMPAIGN_TITLE', 'Campaign title cannot be empty.');
  }
}

export class CampaignTitleTooLongError extends DomainError {
  readonly code = 'CAMPAIGN_TITLE_TOO_LONG';
  constructor() {
    super('CAMPAIGN_TITLE_TOO_LONG', 'Campaign title must be 200 characters or fewer.');
  }
}

export class InvalidCreatorIdError extends DomainError {
  readonly code = 'INVALID_CREATOR_ID';
  constructor() {
    super('INVALID_CREATOR_ID', 'Creator user ID must be a valid UUID.');
  }
}

export class CampaignNotEditableError extends DomainError {
  readonly code = 'CAMPAIGN_NOT_EDITABLE';
  constructor() {
    super('CAMPAIGN_NOT_EDITABLE', 'This campaign cannot be edited in its current state.');
  }
}

export class CampaignNotSubmittableError extends DomainError {
  readonly code = 'CAMPAIGN_NOT_SUBMITTABLE';
  constructor() {
    super('CAMPAIGN_NOT_SUBMITTABLE', 'This campaign cannot be submitted in its current state.');
  }
}

export class CampaignAlreadySubmittedError extends DomainError {
  readonly code = 'CAMPAIGN_ALREADY_SUBMITTED';
  constructor() {
    super('CAMPAIGN_ALREADY_SUBMITTED', 'This campaign has already been submitted for review.');
  }
}

export class CampaignNotRevizableError extends DomainError {
  readonly code = 'CAMPAIGN_NOT_REVIZABLE';
  constructor() {
    super(
      'CAMPAIGN_NOT_REVIZABLE',
      'This campaign cannot be resubmitted while under review or approved.',
    );
  }
}

export class CampaignNotClaimableError extends DomainError {
  readonly code = 'CAMPAIGN_NOT_CLAIMABLE';
  constructor() {
    super('CAMPAIGN_NOT_CLAIMABLE', 'Only submitted campaigns can be claimed for review.');
  }
}

export class CampaignAlreadyClaimedError extends DomainError {
  readonly code = 'CAMPAIGN_ALREADY_CLAIMED';
  constructor() {
    super('CAMPAIGN_ALREADY_CLAIMED', 'This campaign has already been claimed by another reviewer.');
  }
}

export class CampaignNotApprovableError extends DomainError {
  readonly code = 'CAMPAIGN_NOT_APPROVABLE';
  constructor() {
    super('CAMPAIGN_NOT_APPROVABLE', 'Only campaigns under review can be approved.');
  }
}

export class CampaignNotRejectableError extends DomainError {
  readonly code = 'CAMPAIGN_NOT_REJECTABLE';
  constructor() {
    super('CAMPAIGN_NOT_REJECTABLE', 'Only campaigns under review can be rejected.');
  }
}

export class CampaignNotLaunchableError extends DomainError {
  readonly code = 'CAMPAIGN_NOT_LAUNCHABLE';
  constructor() {
    super('CAMPAIGN_NOT_LAUNCHABLE', 'Only approved campaigns can be launched.');
  }
}

export class CampaignCannotArchiveError extends DomainError {
  readonly code = 'CAMPAIGN_CANNOT_ARCHIVE';
  constructor() {
    super(
      'CAMPAIGN_CANNOT_ARCHIVE',
      'This campaign cannot be archived in its current state. Only draft or rejected campaigns can be self-archived.',
    );
  }
}

export class CampaignInvalidStateError extends DomainError {
  readonly code = 'CAMPAIGN_INVALID_STATE';
  constructor() {
    super('CAMPAIGN_INVALID_STATE', 'The campaign is not in a valid state for this operation.');
  }
}

export class CampaignNotFoundError extends DomainError {
  readonly code = 'CAMPAIGN_NOT_FOUND';
  constructor() {
    super('CAMPAIGN_NOT_FOUND', 'Campaign not found.');
  }
}

export class NotAssignedReviewerError extends DomainError {
  readonly code = 'NOT_ASSIGNED_REVIEWER';
  constructor() {
    super('NOT_ASSIGNED_REVIEWER', 'You are not the assigned reviewer for this campaign.');
  }
}

export class ReviewerRoleRequiredError extends DomainError {
  readonly code = 'REVIEWER_ROLE_REQUIRED';
  constructor() {
    super('REVIEWER_ROLE_REQUIRED', 'Reviewer access is required for this action.');
  }
}

export class AdminRoleRequiredError extends DomainError {
  readonly code = 'ADMIN_ROLE_REQUIRED';
  constructor() {
    super('ADMIN_ROLE_REQUIRED', 'Administrator access is required for this action.');
  }
}

export class ReassignTargetNotReviewerError extends DomainError {
  readonly code = 'REASSIGN_TARGET_NOT_REVIEWER';
  constructor() {
    super(
      'REASSIGN_TARGET_NOT_REVIEWER',
      'The specified user does not have the Reviewer role and cannot be assigned as a reviewer.',
    );
  }
}

export class MilestoneValidationError extends DomainError {
  readonly code = 'MILESTONE_VALIDATION_ERROR';
  readonly field: string;

  constructor(field: string, message: string) {
    super('MILESTONE_VALIDATION_ERROR', message);
    this.field = field;
  }
}

export class SubmissionValidationError extends DomainError {
  readonly code = 'SUBMISSION_VALIDATION_ERROR';
  readonly field: string;

  constructor(field: string, message: string) {
    super('SUBMISSION_VALIDATION_ERROR', message);
    this.field = field;
  }
}
