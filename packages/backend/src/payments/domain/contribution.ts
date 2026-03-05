import {
  InvalidContributionAmountError,
  InvalidContributionDataError,
  InvalidContributionStateError,
} from './payment-errors.js';

export type ContributionStatus =
  | 'pending_capture'
  | 'captured'
  | 'failed'
  | 'refunded'
  | 'partially_refunded';

interface ContributionProps {
  readonly id: string;
  readonly donorId: string;
  readonly campaignId: string;
  readonly amountCents: number;
  readonly status: ContributionStatus;
  readonly gatewayReference: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateContributionInput {
  readonly donorId: string;
  readonly campaignId: string;
  readonly amountCents: number;
}

export class Contribution {
  private constructor(private readonly props: ContributionProps) {}

  /** Creates a new contribution with full validation. */
  static create(input: CreateContributionInput): Contribution {
    if (!input.donorId || input.donorId.trim().length === 0) {
      throw new InvalidContributionDataError('donorId must be a non-empty string.');
    }

    if (!input.campaignId || input.campaignId.trim().length === 0) {
      throw new InvalidContributionDataError('campaignId must be a non-empty string.');
    }

    if (!Number.isInteger(input.amountCents) || input.amountCents < 100) {
      throw new InvalidContributionAmountError();
    }

    return new Contribution({
      id: crypto.randomUUID(),
      donorId: input.donorId,
      campaignId: input.campaignId,
      amountCents: input.amountCents,
      status: 'pending_capture',
      gatewayReference: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  /** Reconstitutes from persistence — no validation (data is already valid). */
  static reconstitute(props: ContributionProps): Contribution {
    return new Contribution(props);
  }

  get id(): string {
    return this.props.id;
  }

  get donorId(): string {
    return this.props.donorId;
  }

  get campaignId(): string {
    return this.props.campaignId;
  }

  get amountCents(): number {
    return this.props.amountCents;
  }

  get status(): ContributionStatus {
    return this.props.status;
  }

  get gatewayReference(): string | null {
    return this.props.gatewayReference;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  /**
   * Transitions pending_capture → captured, sets gatewayReference.
   * Returns a new Contribution instance (immutable).
   */
  capture(gatewayReference: string): Contribution {
    if (this.props.status !== 'pending_capture') {
      throw new InvalidContributionStateError(this.props.status, 'captured');
    }
    return new Contribution({
      ...this.props,
      status: 'captured',
      gatewayReference,
      updatedAt: new Date(),
    });
  }

  /**
   * Transitions pending_capture → failed.
   * Returns a new Contribution instance (immutable).
   */
  fail(): Contribution {
    if (this.props.status !== 'pending_capture') {
      throw new InvalidContributionStateError(this.props.status, 'failed');
    }
    return new Contribution({
      ...this.props,
      status: 'failed',
      updatedAt: new Date(),
    });
  }

  /**
   * Transitions captured → refunded or partially_refunded → refunded.
   * Returns a new Contribution instance (immutable).
   */
  refund(): Contribution {
    if (this.props.status !== 'captured' && this.props.status !== 'partially_refunded') {
      throw new InvalidContributionStateError(this.props.status, 'refunded');
    }
    return new Contribution({
      ...this.props,
      status: 'refunded',
      updatedAt: new Date(),
    });
  }

  /**
   * Transitions captured → partially_refunded.
   * Returns a new Contribution instance (immutable).
   */
  partiallyRefund(): Contribution {
    if (this.props.status !== 'captured') {
      throw new InvalidContributionStateError(this.props.status, 'partially_refunded');
    }
    return new Contribution({
      ...this.props,
      status: 'partially_refunded',
      updatedAt: new Date(),
    });
  }
}
