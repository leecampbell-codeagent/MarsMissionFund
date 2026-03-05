import {
  CampaignNotApprovableError,
  CampaignNotClaimableError,
  CampaignNotEditableError,
  CampaignNotLaunchableError,
  CampaignNotRejectableError,
  CampaignNotSubmittableError,
  CampaignTitleTooLongError,
  InvalidCampaignTitleError,
  InvalidCreatorIdError,
} from '../errors/campaign-errors.js';
import type { CampaignCategory } from '../value-objects/campaign-category.js';
import {
  CampaignStatus,
  EDITABLE_STATUSES,
  SUBMITTABLE_STATUSES,
} from '../value-objects/campaign-status.js';

export interface Milestone {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly fundingBasisPoints: number;
  readonly targetDate: string | null;
}

export interface TeamMember {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly bio: string | null;
}

export interface RiskDisclosure {
  readonly id: string;
  readonly risk: string;
  readonly mitigation: string;
}

export interface BudgetItem {
  readonly id: string;
  readonly category: string;
  readonly description: string;
  readonly estimatedCents: string;
  readonly notes?: string;
}

export interface CampaignData {
  readonly id: string;
  readonly creatorUserId: string;
  readonly title: string;
  readonly shortDescription: string | null;
  readonly description: string | null;
  readonly category: CampaignCategory | null;
  readonly heroImageUrl: string | null;
  readonly fundingGoalCents: string | null;
  readonly fundingCapCents: string | null;
  readonly deadline: Date | null;
  readonly milestones: Milestone[];
  readonly teamMembers: TeamMember[];
  readonly riskDisclosures: RiskDisclosure[];
  readonly budgetBreakdown: BudgetItem[];
  readonly alignmentStatement: string | null;
  readonly tags: string[];
  readonly status: CampaignStatus;
  readonly rejectionReason: string | null;
  readonly resubmissionGuidance: string | null;
  readonly reviewNotes: string | null;
  readonly reviewedByUserId: string | null;
  readonly reviewedAt: Date | null;
  readonly submittedAt: Date | null;
  readonly launchedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateCampaignInput {
  readonly creatorUserId: string;
  readonly title: string;
}

export interface UpdateCampaignInput {
  readonly title?: string;
  readonly shortDescription?: string;
  readonly description?: string;
  readonly category?: CampaignCategory;
  readonly heroImageUrl?: string | null;
  readonly fundingGoalCents?: string;
  readonly fundingCapCents?: string;
  readonly deadline?: string;
  readonly milestones?: Milestone[];
  readonly teamMembers?: TeamMember[];
  readonly riskDisclosures?: RiskDisclosure[];
  readonly budgetBreakdown?: BudgetItem[];
  readonly alignmentStatement?: string;
  readonly tags?: string[];
}

export class Campaign {
  private constructor(private readonly props: CampaignData) {}

  // ─── Accessors ────────────────────────────────────────────────────────────

  get id(): string {
    return this.props.id;
  }
  get creatorUserId(): string {
    return this.props.creatorUserId;
  }
  get title(): string {
    return this.props.title;
  }
  get shortDescription(): string | null {
    return this.props.shortDescription;
  }
  get description(): string | null {
    return this.props.description;
  }
  get category(): CampaignCategory | null {
    return this.props.category;
  }
  get heroImageUrl(): string | null {
    return this.props.heroImageUrl;
  }
  get fundingGoalCents(): string | null {
    return this.props.fundingGoalCents;
  }
  get fundingCapCents(): string | null {
    return this.props.fundingCapCents;
  }
  get deadline(): Date | null {
    return this.props.deadline;
  }
  get milestones(): Milestone[] {
    return this.props.milestones;
  }
  get teamMembers(): TeamMember[] {
    return this.props.teamMembers;
  }
  get riskDisclosures(): RiskDisclosure[] {
    return this.props.riskDisclosures;
  }
  get budgetBreakdown(): BudgetItem[] {
    return this.props.budgetBreakdown;
  }
  get alignmentStatement(): string | null {
    return this.props.alignmentStatement;
  }
  get tags(): string[] {
    return this.props.tags;
  }
  get status(): CampaignStatus {
    return this.props.status;
  }
  get rejectionReason(): string | null {
    return this.props.rejectionReason;
  }
  get resubmissionGuidance(): string | null {
    return this.props.resubmissionGuidance;
  }
  get reviewNotes(): string | null {
    return this.props.reviewNotes;
  }
  get reviewedByUserId(): string | null {
    return this.props.reviewedByUserId;
  }
  get reviewedAt(): Date | null {
    return this.props.reviewedAt;
  }
  get submittedAt(): Date | null {
    return this.props.submittedAt;
  }
  get launchedAt(): Date | null {
    return this.props.launchedAt;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  // ─── Factory ────────────────────────────────────────────────────────────

  /**
   * Creates a new Campaign draft with validation.
   * Throws domain errors if input is invalid.
   */
  static create(input: CreateCampaignInput): Campaign {
    if (!input.creatorUserId || input.creatorUserId.trim() === '') {
      throw new InvalidCreatorIdError();
    }

    const trimmedTitle = input.title.trim();
    if (trimmedTitle.length === 0) {
      throw new InvalidCampaignTitleError();
    }
    if (trimmedTitle.length > 200) {
      throw new CampaignTitleTooLongError();
    }

    const now = new Date();
    return new Campaign({
      id: crypto.randomUUID(),
      creatorUserId: input.creatorUserId,
      title: trimmedTitle,
      shortDescription: null,
      description: null,
      category: null,
      heroImageUrl: null,
      fundingGoalCents: null,
      fundingCapCents: null,
      deadline: null,
      milestones: [],
      teamMembers: [],
      riskDisclosures: [],
      budgetBreakdown: [],
      alignmentStatement: null,
      tags: [],
      status: CampaignStatus.Draft,
      rejectionReason: null,
      resubmissionGuidance: null,
      reviewNotes: null,
      reviewedByUserId: null,
      reviewedAt: null,
      submittedAt: null,
      launchedAt: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  /**
   * Reconstitutes a Campaign from persisted data.
   * No validation — data is trusted from the database.
   */
  static reconstitute(data: CampaignData): Campaign {
    return new Campaign(data);
  }

  // ─── Business Methods ─────────────────────────────────────────────────────

  /**
   * Returns a new Campaign with updated draft fields.
   * Only fields present in input are changed.
   * Throws CampaignNotEditableError if status is not in EDITABLE_STATUSES.
   */
  updateDraft(input: UpdateCampaignInput): Campaign {
    if (!EDITABLE_STATUSES.includes(this.props.status)) {
      throw new CampaignNotEditableError();
    }

    return new Campaign({
      ...this.props,
      title: input.title !== undefined ? input.title : this.props.title,
      shortDescription:
        input.shortDescription !== undefined ? input.shortDescription : this.props.shortDescription,
      description: input.description !== undefined ? input.description : this.props.description,
      category: input.category !== undefined ? input.category : this.props.category,
      heroImageUrl: input.heroImageUrl !== undefined ? input.heroImageUrl : this.props.heroImageUrl,
      fundingGoalCents:
        input.fundingGoalCents !== undefined ? input.fundingGoalCents : this.props.fundingGoalCents,
      fundingCapCents:
        input.fundingCapCents !== undefined ? input.fundingCapCents : this.props.fundingCapCents,
      deadline: input.deadline !== undefined ? new Date(input.deadline) : this.props.deadline,
      milestones: input.milestones !== undefined ? input.milestones : this.props.milestones,
      teamMembers: input.teamMembers !== undefined ? input.teamMembers : this.props.teamMembers,
      riskDisclosures:
        input.riskDisclosures !== undefined ? input.riskDisclosures : this.props.riskDisclosures,
      budgetBreakdown:
        input.budgetBreakdown !== undefined ? input.budgetBreakdown : this.props.budgetBreakdown,
      alignmentStatement:
        input.alignmentStatement !== undefined
          ? input.alignmentStatement
          : this.props.alignmentStatement,
      tags: input.tags !== undefined ? input.tags : this.props.tags,
      updatedAt: new Date(),
    });
  }

  /**
   * Returns a new Campaign with status = 'submitted' and submittedAt set.
   * Does NOT perform submission validation — application service validates before calling.
   * Throws CampaignNotSubmittableError if status is not in SUBMITTABLE_STATUSES.
   */
  submit(submittedAt: Date): Campaign {
    if (!SUBMITTABLE_STATUSES.includes(this.props.status)) {
      throw new CampaignNotSubmittableError();
    }

    return new Campaign({
      ...this.props,
      status: CampaignStatus.Submitted,
      submittedAt,
      updatedAt: new Date(),
    });
  }

  /**
   * Returns a new Campaign with status = 'under_review' and reviewedByUserId set.
   * Throws CampaignNotClaimableError if status !== 'submitted'.
   */
  claim(reviewerUserId: string, claimedAt: Date): Campaign {
    if (this.props.status !== CampaignStatus.Submitted) {
      throw new CampaignNotClaimableError();
    }

    return new Campaign({
      ...this.props,
      status: CampaignStatus.UnderReview,
      reviewedByUserId: reviewerUserId,
      updatedAt: claimedAt,
    });
  }

  /**
   * Returns a new Campaign with status = 'approved', reviewNotes, and reviewedAt set.
   * Throws CampaignNotApprovableError if status !== 'under_review'.
   */
  approve(reviewNotes: string, reviewedAt: Date): Campaign {
    if (this.props.status !== CampaignStatus.UnderReview) {
      throw new CampaignNotApprovableError();
    }

    return new Campaign({
      ...this.props,
      status: CampaignStatus.Approved,
      reviewNotes,
      reviewedAt,
      updatedAt: new Date(),
    });
  }

  /**
   * Returns a new Campaign with status = 'rejected', rejectionReason,
   * resubmissionGuidance, and reviewedAt set.
   * Throws CampaignNotRejectableError if status !== 'under_review'.
   */
  reject(rejectionReason: string, resubmissionGuidance: string, reviewedAt: Date): Campaign {
    if (this.props.status !== CampaignStatus.UnderReview) {
      throw new CampaignNotRejectableError();
    }

    return new Campaign({
      ...this.props,
      status: CampaignStatus.Rejected,
      rejectionReason,
      resubmissionGuidance,
      reviewedAt,
      updatedAt: new Date(),
    });
  }

  /**
   * Returns a new Campaign with status = 'live' and launchedAt set.
   * Throws CampaignNotLaunchableError if status !== 'approved'.
   */
  launch(launchedAt: Date): Campaign {
    if (this.props.status !== CampaignStatus.Approved) {
      throw new CampaignNotLaunchableError();
    }

    return new Campaign({
      ...this.props,
      status: CampaignStatus.Live,
      launchedAt,
      updatedAt: new Date(),
    });
  }

  /**
   * Returns a new Campaign with status = 'archived'.
   * Application service checks status before calling this method.
   */
  archive(): Campaign {
    return new Campaign({
      ...this.props,
      status: CampaignStatus.Archived,
      updatedAt: new Date(),
    });
  }
}
