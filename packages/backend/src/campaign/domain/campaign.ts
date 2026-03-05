import {
  CampaignAlreadySubmittedError,
  CampaignNotReviewableError,
  InvalidCampaignError,
  ReviewerCommentRequiredError,
} from './errors.js';
import type { Milestone } from './milestone.js';

export type CampaignStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'live'
  | 'funded'
  | 'suspended'
  | 'failed'
  | 'settlement'
  | 'complete'
  | 'cancelled';

export type CampaignCategory =
  | 'propulsion'
  | 'entry_descent_landing'
  | 'power_energy'
  | 'habitats_construction'
  | 'life_support_crew_health'
  | 'food_water_production'
  | 'isru'
  | 'radiation_protection'
  | 'robotics_automation'
  | 'communications_navigation';

export const VALID_CAMPAIGN_CATEGORIES = new Set<CampaignCategory>([
  'propulsion',
  'entry_descent_landing',
  'power_energy',
  'habitats_construction',
  'life_support_crew_health',
  'food_water_production',
  'isru',
  'radiation_protection',
  'robotics_automation',
  'communications_navigation',
]);

/** Minimum funding target: $1,000,000 in cents */
export const MIN_FUNDING_TARGET_CENTS = 100_000_000;

/** Maximum funding target: $1,000,000,000 in cents */
export const MAX_FUNDING_TARGET_CENTS = 100_000_000_000;

/** Minimum campaign duration from submission: 7 days in ms */
export const MIN_DEADLINE_MS = 7 * 24 * 60 * 60 * 1000;

/** Maximum campaign duration from submission: 365 days in ms */
export const MAX_DEADLINE_MS = 365 * 24 * 60 * 60 * 1000;

interface CampaignProps {
  readonly id: string;
  readonly creatorId: string;
  readonly title: string;
  readonly summary: string | null;
  readonly description: string | null;
  readonly marsAlignmentStatement: string | null;
  readonly category: CampaignCategory;
  readonly status: CampaignStatus;
  readonly minFundingTargetCents: number;
  readonly maxFundingCapCents: number;
  readonly deadline: Date | null;
  readonly budgetBreakdown: string | null;
  readonly teamInfo: string | null;
  readonly riskDisclosures: string | null;
  readonly heroImageUrl: string | null;
  readonly reviewerId: string | null;
  readonly reviewerComment: string | null;
  readonly reviewedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateCampaignInput {
  readonly creatorId: string;
  readonly title: string;
  readonly category: CampaignCategory;
  readonly minFundingTargetCents: number;
  readonly maxFundingCapCents: number;
  readonly summary?: string | null;
  readonly description?: string | null;
  readonly marsAlignmentStatement?: string | null;
  readonly deadline?: Date | null;
  readonly budgetBreakdown?: string | null;
  readonly teamInfo?: string | null;
  readonly riskDisclosures?: string | null;
  readonly heroImageUrl?: string | null;
}

export interface UpdateCampaignInput {
  readonly title?: string | null;
  readonly summary?: string | null;
  readonly description?: string | null;
  readonly marsAlignmentStatement?: string | null;
  readonly category?: CampaignCategory | null;
  readonly minFundingTargetCents?: number | null;
  readonly maxFundingCapCents?: number | null;
  readonly deadline?: Date | null;
  readonly budgetBreakdown?: string | null;
  readonly teamInfo?: string | null;
  readonly riskDisclosures?: string | null;
  readonly heroImageUrl?: string | null;
}

export interface SubmitCampaignOptions {
  readonly milestones: readonly Milestone[];
  readonly submittedAt?: Date;
}

export class Campaign {
  private constructor(private readonly props: CampaignProps) {}

  /** Creates a new Campaign in draft state with validation. */
  static create(input: CreateCampaignInput): Campaign {
    if (!input.creatorId || input.creatorId.trim().length === 0) {
      throw new InvalidCampaignError('creatorId must be a non-empty string.');
    }

    const title = input.title?.trim();
    if (!title || title.length === 0) {
      throw new InvalidCampaignError('Campaign title is required.');
    }
    if (title.length > 200) {
      throw new InvalidCampaignError('Campaign title must be 200 characters or fewer.');
    }

    if (!VALID_CAMPAIGN_CATEGORIES.has(input.category)) {
      throw new InvalidCampaignError(`Invalid campaign category: ${input.category}`);
    }

    if (!Number.isInteger(input.minFundingTargetCents) || input.minFundingTargetCents <= 0) {
      throw new InvalidCampaignError('Minimum funding target must be a positive integer (cents).');
    }

    if (!Number.isInteger(input.maxFundingCapCents) || input.maxFundingCapCents <= 0) {
      throw new InvalidCampaignError('Maximum funding cap must be a positive integer (cents).');
    }

    if (input.maxFundingCapCents < input.minFundingTargetCents) {
      throw new InvalidCampaignError('Maximum funding cap must be at least equal to the minimum funding target.');
    }

    return new Campaign({
      id: crypto.randomUUID(),
      creatorId: input.creatorId,
      title,
      summary: input.summary ?? null,
      description: input.description ?? null,
      marsAlignmentStatement: input.marsAlignmentStatement ?? null,
      category: input.category,
      status: 'draft',
      minFundingTargetCents: input.minFundingTargetCents,
      maxFundingCapCents: input.maxFundingCapCents,
      deadline: input.deadline ?? null,
      budgetBreakdown: input.budgetBreakdown ?? null,
      teamInfo: input.teamInfo ?? null,
      riskDisclosures: input.riskDisclosures ?? null,
      heroImageUrl: input.heroImageUrl ?? null,
      reviewerId: null,
      reviewerComment: null,
      reviewedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  /** Reconstitutes from persistence — no validation. */
  static reconstitute(props: Omit<CampaignProps, 'reviewerId' | 'reviewerComment' | 'reviewedAt'> & {
    reviewerId?: string | null;
    reviewerComment?: string | null;
    reviewedAt?: Date | null;
  }): Campaign {
    return new Campaign({
      ...props,
      reviewerId: props.reviewerId ?? null,
      reviewerComment: props.reviewerComment ?? null,
      reviewedAt: props.reviewedAt ?? null,
    });
  }

  get id(): string { return this.props.id; }
  get creatorId(): string { return this.props.creatorId; }
  get title(): string { return this.props.title; }
  get summary(): string | null { return this.props.summary; }
  get description(): string | null { return this.props.description; }
  get marsAlignmentStatement(): string | null { return this.props.marsAlignmentStatement; }
  get category(): CampaignCategory { return this.props.category; }
  get status(): CampaignStatus { return this.props.status; }
  get minFundingTargetCents(): number { return this.props.minFundingTargetCents; }
  get maxFundingCapCents(): number { return this.props.maxFundingCapCents; }
  get deadline(): Date | null { return this.props.deadline; }
  get budgetBreakdown(): string | null { return this.props.budgetBreakdown; }
  get teamInfo(): string | null { return this.props.teamInfo; }
  get riskDisclosures(): string | null { return this.props.riskDisclosures; }
  get heroImageUrl(): string | null { return this.props.heroImageUrl; }
  get reviewerId(): string | null { return this.props.reviewerId; }
  get reviewerComment(): string | null { return this.props.reviewerComment; }
  get reviewedAt(): Date | null { return this.props.reviewedAt; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  isDraft(): boolean {
    return this.props.status === 'draft';
  }

  isSubmitted(): boolean {
    return this.props.status === 'submitted';
  }

  /**
   * Returns a new Campaign with updated draft fields.
   * Only allowed if the campaign is in draft status.
   */
  withDraftUpdate(input: UpdateCampaignInput): Campaign {
    if (!this.isDraft()) {
      throw new CampaignAlreadySubmittedError();
    }

    let title = this.props.title;
    if (input.title !== undefined && input.title !== null) {
      const trimmed = input.title.trim();
      if (trimmed.length === 0) {
        throw new InvalidCampaignError('Campaign title must not be empty.');
      }
      if (trimmed.length > 200) {
        throw new InvalidCampaignError('Campaign title must be 200 characters or fewer.');
      }
      title = trimmed;
    }

    let category = this.props.category;
    if (input.category !== undefined && input.category !== null) {
      if (!VALID_CAMPAIGN_CATEGORIES.has(input.category)) {
        throw new InvalidCampaignError(`Invalid campaign category: ${input.category}`);
      }
      category = input.category;
    }

    let minFundingTargetCents = this.props.minFundingTargetCents;
    if (input.minFundingTargetCents !== undefined && input.minFundingTargetCents !== null) {
      if (!Number.isInteger(input.minFundingTargetCents) || input.minFundingTargetCents <= 0) {
        throw new InvalidCampaignError('Minimum funding target must be a positive integer (cents).');
      }
      minFundingTargetCents = input.minFundingTargetCents;
    }

    let maxFundingCapCents = this.props.maxFundingCapCents;
    if (input.maxFundingCapCents !== undefined && input.maxFundingCapCents !== null) {
      if (!Number.isInteger(input.maxFundingCapCents) || input.maxFundingCapCents <= 0) {
        throw new InvalidCampaignError('Maximum funding cap must be a positive integer (cents).');
      }
      maxFundingCapCents = input.maxFundingCapCents;
    }

    if (maxFundingCapCents < minFundingTargetCents) {
      throw new InvalidCampaignError('Maximum funding cap must be at least equal to the minimum funding target.');
    }

    return new Campaign({
      ...this.props,
      title,
      summary: input.summary !== undefined ? (input.summary ?? null) : this.props.summary,
      description: input.description !== undefined ? (input.description ?? null) : this.props.description,
      marsAlignmentStatement:
        input.marsAlignmentStatement !== undefined
          ? (input.marsAlignmentStatement ?? null)
          : this.props.marsAlignmentStatement,
      category,
      minFundingTargetCents,
      maxFundingCapCents,
      deadline: input.deadline !== undefined ? (input.deadline ?? null) : this.props.deadline,
      budgetBreakdown:
        input.budgetBreakdown !== undefined ? (input.budgetBreakdown ?? null) : this.props.budgetBreakdown,
      teamInfo: input.teamInfo !== undefined ? (input.teamInfo ?? null) : this.props.teamInfo,
      riskDisclosures:
        input.riskDisclosures !== undefined ? (input.riskDisclosures ?? null) : this.props.riskDisclosures,
      heroImageUrl: input.heroImageUrl !== undefined ? (input.heroImageUrl ?? null) : this.props.heroImageUrl,
      updatedAt: new Date(),
    });
  }

  /**
   * Validates and transitions the campaign to submitted state.
   * Only allowed if in draft status.
   * All submission validation is performed here.
   */
  submit(options: SubmitCampaignOptions): Campaign {
    if (!this.isDraft()) {
      throw new CampaignAlreadySubmittedError();
    }

    const submittedAt = options.submittedAt ?? new Date();

    // Required fields
    if (!this.props.title || this.props.title.trim().length === 0) {
      throw new InvalidCampaignError('Campaign title is required.');
    }
    if (!this.props.summary || this.props.summary.trim().length === 0) {
      throw new InvalidCampaignError('Campaign summary is required for submission.');
    }
    if (this.props.summary.length > 280) {
      throw new InvalidCampaignError('Campaign summary must be 280 characters or fewer.');
    }
    if (!this.props.description || this.props.description.trim().length === 0) {
      throw new InvalidCampaignError('Campaign description is required for submission.');
    }
    if (!this.props.marsAlignmentStatement || this.props.marsAlignmentStatement.trim().length === 0) {
      throw new InvalidCampaignError('Mars alignment statement is required for submission.');
    }

    // Funding range validation
    if (this.props.minFundingTargetCents < MIN_FUNDING_TARGET_CENTS) {
      throw new InvalidCampaignError(
        `Minimum funding target must be at least $1,000,000 (${MIN_FUNDING_TARGET_CENTS} cents).`,
      );
    }
    if (this.props.minFundingTargetCents > MAX_FUNDING_TARGET_CENTS) {
      throw new InvalidCampaignError(
        `Minimum funding target must not exceed $1,000,000,000 (${MAX_FUNDING_TARGET_CENTS} cents).`,
      );
    }

    // Deadline validation
    if (!this.props.deadline) {
      throw new InvalidCampaignError('Campaign deadline is required for submission.');
    }
    const deadlineMs = this.props.deadline.getTime() - submittedAt.getTime();
    if (deadlineMs < MIN_DEADLINE_MS) {
      throw new InvalidCampaignError('Campaign deadline must be at least 7 days from the submission date.');
    }
    if (deadlineMs > MAX_DEADLINE_MS) {
      throw new InvalidCampaignError('Campaign deadline must not exceed 1 year from the submission date.');
    }

    // Milestone validation
    const milestones = options.milestones;
    if (milestones.length < 2) {
      throw new InvalidCampaignError('At least 2 milestones are required for submission.');
    }

    for (const milestone of milestones) {
      if (!milestone.title || milestone.title.trim().length === 0) {
        throw new InvalidCampaignError('All milestones must have a title.');
      }
      if (!milestone.targetDate) {
        throw new InvalidCampaignError('All milestones must have a target date.');
      }
      if (milestone.fundingPercentage === null || milestone.fundingPercentage === undefined) {
        throw new InvalidCampaignError('All milestones must have a funding percentage.');
      }
    }

    const percentageSum = milestones.reduce(
      (sum, m) => sum + (m.fundingPercentage ?? 0),
      0,
    );
    if (percentageSum !== 100) {
      throw new InvalidCampaignError(
        `Milestone funding percentages must sum to 100%. Current sum: ${percentageSum}%.`,
      );
    }

    // Team info validation (must be parseable as non-empty array)
    if (!this.props.teamInfo || this.props.teamInfo.trim().length === 0) {
      throw new InvalidCampaignError('Team information is required for submission.');
    }
    try {
      const teamArr = JSON.parse(this.props.teamInfo) as unknown;
      if (!Array.isArray(teamArr) || teamArr.length === 0) {
        throw new InvalidCampaignError('At least one team member is required for submission.');
      }
    } catch (e) {
      if (e instanceof InvalidCampaignError) throw e;
      throw new InvalidCampaignError('Team information must be a valid JSON array.');
    }

    // Risk disclosures validation
    if (!this.props.riskDisclosures || this.props.riskDisclosures.trim().length === 0) {
      throw new InvalidCampaignError('Risk disclosures are required for submission.');
    }
    try {
      const riskArr = JSON.parse(this.props.riskDisclosures) as unknown;
      if (!Array.isArray(riskArr) || riskArr.length === 0) {
        throw new InvalidCampaignError('At least one risk disclosure is required for submission.');
      }
    } catch (e) {
      if (e instanceof InvalidCampaignError) throw e;
      throw new InvalidCampaignError('Risk disclosures must be a valid JSON array.');
    }

    return new Campaign({
      ...this.props,
      status: 'submitted',
      updatedAt: submittedAt,
    });
  }

  /**
   * Transitions submitted → under_review.
   * Only allowed if status is 'submitted'.
   */
  startReview(reviewerId: string, reviewedAt?: Date): Campaign {
    if (this.props.status !== 'submitted') {
      throw new CampaignNotReviewableError(
        'Campaign must be in submitted status to start review.',
      );
    }
    const now = reviewedAt ?? new Date();
    return new Campaign({
      ...this.props,
      status: 'under_review',
      reviewerId,
      reviewedAt: now,
      updatedAt: now,
    });
  }

  /**
   * Transitions under_review → approved.
   * Only the assigned reviewer may approve. A written comment is required.
   */
  approve(reviewerId: string, comment: string, reviewedAt?: Date): Campaign {
    if (this.props.status !== 'under_review') {
      throw new CampaignNotReviewableError(
        'Campaign must be under review to approve.',
      );
    }
    if (this.props.reviewerId !== reviewerId) {
      throw new CampaignNotReviewableError(
        'Only the assigned reviewer may approve this campaign.',
      );
    }
    if (!comment || comment.trim().length === 0) {
      throw new ReviewerCommentRequiredError();
    }
    const now = reviewedAt ?? new Date();
    return new Campaign({
      ...this.props,
      status: 'approved',
      reviewerComment: comment.trim(),
      reviewedAt: now,
      updatedAt: now,
    });
  }

  /**
   * Transitions under_review → rejected.
   * Only the assigned reviewer may reject. A written comment is required.
   */
  reject(reviewerId: string, comment: string, reviewedAt?: Date): Campaign {
    if (this.props.status !== 'under_review') {
      throw new CampaignNotReviewableError(
        'Campaign must be under review to reject.',
      );
    }
    if (this.props.reviewerId !== reviewerId) {
      throw new CampaignNotReviewableError(
        'Only the assigned reviewer may reject this campaign.',
      );
    }
    if (!comment || comment.trim().length === 0) {
      throw new ReviewerCommentRequiredError();
    }
    const now = reviewedAt ?? new Date();
    return new Campaign({
      ...this.props,
      status: 'rejected',
      reviewerComment: comment.trim(),
      reviewedAt: now,
      updatedAt: now,
    });
  }

  /**
   * Transitions under_review → submitted (reviewer recuses).
   * Only the assigned reviewer may recuse. Clears reviewer fields.
   */
  recuse(reviewerId: string): Campaign {
    if (this.props.status !== 'under_review') {
      throw new CampaignNotReviewableError(
        'Campaign must be under review to recuse.',
      );
    }
    if (this.props.reviewerId !== reviewerId) {
      throw new CampaignNotReviewableError(
        'Only the assigned reviewer may recuse from this campaign.',
      );
    }
    return new Campaign({
      ...this.props,
      status: 'submitted',
      reviewerId: null,
      reviewerComment: null,
      reviewedAt: null,
      updatedAt: new Date(),
    });
  }

  /**
   * Transitions rejected → draft (creator chooses to revise).
   * Previous data is preserved; reviewer info preserved for audit history.
   */
  returnToDraft(): Campaign {
    if (this.props.status !== 'rejected') {
      throw new CampaignNotReviewableError(
        'Campaign must be in rejected status to return to draft.',
      );
    }
    return new Campaign({
      ...this.props,
      status: 'draft',
      updatedAt: new Date(),
    });
  }
}
