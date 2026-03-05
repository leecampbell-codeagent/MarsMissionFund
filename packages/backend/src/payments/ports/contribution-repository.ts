import type { TransactionClient } from '../../shared/ports/transaction-port.js';
import type { Contribution } from '../domain/contribution.js';

export interface ContributionRepository {
  save(contribution: Contribution): Promise<void>;
  update(contribution: Contribution, txClient?: TransactionClient): Promise<void>;
  findById(id: string): Promise<Contribution | null>;
  findByDonorId(donorId: string): Promise<Contribution[]>;
  findByCampaignId(campaignId: string): Promise<Contribution[]>;
}
