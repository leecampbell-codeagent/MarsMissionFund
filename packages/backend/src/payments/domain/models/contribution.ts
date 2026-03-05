import {
  ContributionAmountBelowMinimumError,
  InvalidContributionAmountError,
  InvalidContributionCampaignIdError,
  InvalidContributionDonorIdError,
} from '../errors/payment-errors.js';
import { ContributionStatus } from '../value-objects/contribution-status.js';

export const MINIMUM_CONTRIBUTION_CENTS = 500; // $5.00 USD

export interface ContributionData {
  readonly id: string;
  readonly donorUserId: string;
  readonly campaignId: string;
  readonly amountCents: number; // Integer cents; BIGINT from DB parsed to number (safe for amounts < $90T)
  readonly paymentToken: string; // NEVER LOG
  readonly status: ContributionStatus;
  readonly transactionRef: string | null;
  readonly failureReason: string | null;
  readonly idempotencyKey: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateContributionInput {
  readonly donorUserId: string;
  readonly campaignId: string;
  readonly amountCents: number;
  readonly paymentToken: string; // NEVER LOG
  readonly idempotencyKey?: string;
}

export class Contribution {
  private constructor(private readonly props: ContributionData) {}

  // Getters
  get id(): string {
    return this.props.id;
  }
  get donorUserId(): string {
    return this.props.donorUserId;
  }
  get campaignId(): string {
    return this.props.campaignId;
  }
  get amountCents(): number {
    return this.props.amountCents;
  }
  get paymentToken(): string {
    return this.props.paymentToken;
  }
  get status(): ContributionStatus {
    return this.props.status;
  }
  get transactionRef(): string | null {
    return this.props.transactionRef;
  }
  get failureReason(): string | null {
    return this.props.failureReason;
  }
  get idempotencyKey(): string | null {
    return this.props.idempotencyKey;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  /**
   * create() — validates business rules.
   * Called when a new contribution is initiated.
   */
  static create(input: CreateContributionInput): Contribution {
    if (!input.donorUserId || input.donorUserId.trim() === '') {
      throw new InvalidContributionDonorIdError();
    }
    if (!input.campaignId || input.campaignId.trim() === '') {
      throw new InvalidContributionCampaignIdError();
    }
    if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
      throw new InvalidContributionAmountError();
    }
    if (input.amountCents < MINIMUM_CONTRIBUTION_CENTS) {
      throw new ContributionAmountBelowMinimumError(input.amountCents);
    }

    return new Contribution({
      id: '', // Set by DB on insert
      donorUserId: input.donorUserId,
      campaignId: input.campaignId,
      amountCents: input.amountCents,
      paymentToken: input.paymentToken,
      status: ContributionStatus.PendingCapture,
      transactionRef: null,
      failureReason: null,
      idempotencyKey: input.idempotencyKey ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  /**
   * reconstitute() — no validation. Called when reading from DB.
   */
  static reconstitute(data: ContributionData): Contribution {
    return new Contribution(data);
  }

  /**
   * capture() — transitions to 'captured'. Returns new immutable instance.
   */
  capture(transactionRef: string): Contribution {
    return new Contribution({
      ...this.props,
      status: ContributionStatus.Captured,
      transactionRef,
      updatedAt: new Date(),
    });
  }

  /**
   * fail() — transitions to 'failed'. Returns new immutable instance.
   */
  fail(reason: string): Contribution {
    return new Contribution({
      ...this.props,
      status: ContributionStatus.Failed,
      failureReason: reason,
      updatedAt: new Date(),
    });
  }
}
