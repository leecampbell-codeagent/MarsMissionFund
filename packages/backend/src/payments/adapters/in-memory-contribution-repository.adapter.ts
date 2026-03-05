import type { PoolClient } from 'pg';
import { Contribution } from '../domain/models/contribution.js';
import type { ContributionStatus } from '../domain/value-objects/contribution-status.js';
import type { ContributionRepository } from '../ports/contribution-repository.port.js';

/**
 * In-memory implementation for tests.
 * Exposed `contributions` map allows test assertions.
 */
export class InMemoryContributionRepository implements ContributionRepository {
  readonly contributions: Map<string, Contribution> = new Map();

  // For testing duplicate detection: override window behavior
  private _duplicateOverride: boolean | null = null;

  /**
   * Force existsDuplicate to return a specific value in tests.
   */
  setDuplicateOverride(value: boolean | null): void {
    this._duplicateOverride = value;
  }

  async save(contribution: Contribution): Promise<Contribution> {
    // Assign a UUID as DB would
    const id = crypto.randomUUID();
    const saved = Contribution.reconstitute({
      id,
      donorUserId: contribution.donorUserId,
      campaignId: contribution.campaignId,
      amountCents: contribution.amountCents,
      paymentToken: contribution.paymentToken,
      status: contribution.status,
      transactionRef: contribution.transactionRef,
      failureReason: contribution.failureReason,
      idempotencyKey: contribution.idempotencyKey,
      createdAt: contribution.createdAt,
      updatedAt: contribution.updatedAt,
    });
    this.contributions.set(id, saved);
    return saved;
  }

  async findById(id: string): Promise<Contribution | null> {
    return this.contributions.get(id) ?? null;
  }

  async findByIdForDonor(id: string, donorUserId: string): Promise<Contribution | null> {
    const contribution = this.contributions.get(id);
    if (!contribution) return null;
    if (contribution.donorUserId !== donorUserId) return null;
    return contribution;
  }

  async updateStatus(
    contributionId: string,
    status: string,
    transactionRef: string | null,
    failureReason: string | null,
    _client?: PoolClient,
  ): Promise<Contribution> {
    const existing = this.contributions.get(contributionId);
    if (!existing) {
      throw new Error(`Contribution ${contributionId} not found`);
    }

    const updated = Contribution.reconstitute({
      id: existing.id,
      donorUserId: existing.donorUserId,
      campaignId: existing.campaignId,
      amountCents: existing.amountCents,
      paymentToken: existing.paymentToken,
      status: status as ContributionStatus,
      transactionRef,
      failureReason,
      idempotencyKey: existing.idempotencyKey,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    });
    this.contributions.set(contributionId, updated);
    return updated;
  }

  async existsDuplicate(
    donorUserId: string,
    campaignId: string,
    amountCents: number,
    windowSeconds: number,
  ): Promise<boolean> {
    if (this._duplicateOverride !== null) {
      return this._duplicateOverride;
    }

    const windowMs = windowSeconds * 1000;
    const cutoff = Date.now() - windowMs;

    for (const contribution of this.contributions.values()) {
      if (
        contribution.donorUserId === donorUserId &&
        contribution.campaignId === campaignId &&
        contribution.amountCents === amountCents &&
        contribution.status !== 'failed' &&
        contribution.createdAt.getTime() > cutoff
      ) {
        return true;
      }
    }
    return false;
  }

  async listByDonorForCampaign(
    donorUserId: string,
    campaignId: string,
    limit: number,
    offset: number,
  ): Promise<Contribution[]> {
    const results = Array.from(this.contributions.values())
      .filter((c) => c.donorUserId === donorUserId && c.campaignId === campaignId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return results.slice(offset, offset + limit);
  }
}
