import type { TransactionClient } from '../../../shared/ports/transaction-port.js';
import type { Contribution } from '../../domain/contribution.js';
import type { ContributionRepository } from '../../ports/contribution-repository.js';

export class InMemoryContributionRepository implements ContributionRepository {
  private readonly contributions = new Map<string, Contribution>();

  async save(contribution: Contribution): Promise<void> {
    this.contributions.set(contribution.id, contribution);
  }

  async update(contribution: Contribution, _txClient?: TransactionClient): Promise<void> {
    this.contributions.set(contribution.id, contribution);
  }

  async findById(id: string): Promise<Contribution | null> {
    return this.contributions.get(id) ?? null;
  }

  async findByDonorId(donorId: string): Promise<Contribution[]> {
    return [...this.contributions.values()].filter((c) => c.donorId === donorId);
  }

  async findByCampaignId(campaignId: string): Promise<Contribution[]> {
    return [...this.contributions.values()].filter((c) => c.campaignId === campaignId);
  }

  /** Helper for tests: get all stored contributions */
  getAll(): Contribution[] {
    return [...this.contributions.values()];
  }

  /** Helper for tests: clear all contributions */
  clear(): void {
    this.contributions.clear();
  }

  /** Helper for tests: seed a contribution directly */
  seed(contribution: Contribution): void {
    this.contributions.set(contribution.id, contribution);
  }
}
