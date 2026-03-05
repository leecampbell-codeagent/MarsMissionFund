import { InvalidCampaignError } from './errors.js';

export type MilestoneStatus = 'pending' | 'verified' | 'returned';

export interface MilestoneProps {
  readonly id: string;
  readonly campaignId: string;
  readonly title: string | null;
  readonly description: string | null;
  readonly targetDate: Date | null;
  readonly fundingPercentage: number | null;
  readonly verificationCriteria: string | null;
  readonly status: MilestoneStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateMilestoneInput {
  readonly campaignId: string;
  readonly title?: string | null;
  readonly description?: string | null;
  readonly targetDate?: Date | null;
  readonly fundingPercentage?: number | null;
  readonly verificationCriteria?: string | null;
}

export class Milestone {
  private constructor(private readonly props: MilestoneProps) {}

  /** Creates a new Milestone with optional validation for draft input. */
  static create(input: CreateMilestoneInput): Milestone {
    if (input.fundingPercentage !== undefined && input.fundingPercentage !== null) {
      if (
        !Number.isInteger(input.fundingPercentage) ||
        input.fundingPercentage < 0 ||
        input.fundingPercentage > 100
      ) {
        throw new InvalidCampaignError('Milestone funding percentage must be an integer between 0 and 100.');
      }
    }

    return new Milestone({
      id: crypto.randomUUID(),
      campaignId: input.campaignId,
      title: input.title ?? null,
      description: input.description ?? null,
      targetDate: input.targetDate ?? null,
      fundingPercentage: input.fundingPercentage ?? null,
      verificationCriteria: input.verificationCriteria ?? null,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  /** Reconstitutes from persistence — no validation (data is already valid). */
  static reconstitute(props: MilestoneProps): Milestone {
    return new Milestone(props);
  }

  get id(): string { return this.props.id; }
  get campaignId(): string { return this.props.campaignId; }
  get title(): string | null { return this.props.title; }
  get description(): string | null { return this.props.description; }
  get targetDate(): Date | null { return this.props.targetDate; }
  get fundingPercentage(): number | null { return this.props.fundingPercentage; }
  get verificationCriteria(): string | null { return this.props.verificationCriteria; }
  get status(): MilestoneStatus { return this.props.status; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  /** Returns a new Milestone with updated fields. */
  withUpdate(input: Partial<Omit<CreateMilestoneInput, 'campaignId'>>): Milestone {
    const fundingPercentage =
      input.fundingPercentage !== undefined ? input.fundingPercentage : this.props.fundingPercentage;

    if (fundingPercentage !== null && fundingPercentage !== undefined) {
      if (!Number.isInteger(fundingPercentage) || fundingPercentage < 0 || fundingPercentage > 100) {
        throw new InvalidCampaignError('Milestone funding percentage must be an integer between 0 and 100.');
      }
    }

    return new Milestone({
      ...this.props,
      title: input.title !== undefined ? (input.title ?? null) : this.props.title,
      description: input.description !== undefined ? (input.description ?? null) : this.props.description,
      targetDate: input.targetDate !== undefined ? (input.targetDate ?? null) : this.props.targetDate,
      fundingPercentage: fundingPercentage ?? null,
      verificationCriteria:
        input.verificationCriteria !== undefined
          ? (input.verificationCriteria ?? null)
          : this.props.verificationCriteria,
      updatedAt: new Date(),
    });
  }
}
