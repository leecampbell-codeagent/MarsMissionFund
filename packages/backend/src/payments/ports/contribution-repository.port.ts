import type { PoolClient } from 'pg';
import type { Contribution } from '../domain/models/contribution.js';

export interface ContributionRepository {
  /**
   * Inserts a new contribution. Sets id from DB.
   * Returns the persisted contribution with id populated.
   */
  save(contribution: Contribution): Promise<Contribution>;

  /**
   * Finds a contribution by ID. Returns null if not found.
   */
  findById(id: string): Promise<Contribution | null>;

  /**
   * Finds a contribution by ID scoped to a specific donor.
   * Returns null if not found OR if it belongs to a different donor.
   */
  findByIdForDonor(id: string, donorUserId: string): Promise<Contribution | null>;

  /**
   * Updates status, transactionRef, and failureReason.
   * Returns the updated contribution.
   * Optional client parameter: if provided, runs within the given transaction.
   */
  updateStatus(
    contributionId: string,
    status: string,
    transactionRef: string | null,
    failureReason: string | null,
    client?: PoolClient,
  ): Promise<Contribution>;

  /**
   * Duplicate check: returns true if a non-failed contribution exists for
   * (donorUserId, campaignId, amountCents) created within the last windowSeconds.
   */
  existsDuplicate(
    donorUserId: string,
    campaignId: string,
    amountCents: number,
    windowSeconds: number,
  ): Promise<boolean>;

  /**
   * Lists all contributions by a donor for a specific campaign, ordered by created_at DESC.
   */
  listByDonorForCampaign(
    donorUserId: string,
    campaignId: string,
    limit: number,
    offset: number,
  ): Promise<Contribution[]>;
}
