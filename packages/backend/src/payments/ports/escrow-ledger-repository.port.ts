import type { PoolClient } from 'pg';

export interface EscrowLedgerEntry {
  readonly id: string;
  readonly campaignId: string;
  readonly contributionId: string;
  readonly entryType: 'credit';
  readonly amountCents: number;
  readonly runningBalanceCents: number;
  readonly createdAt: Date;
}

export interface CreateLedgerEntryInput {
  readonly campaignId: string;
  readonly contributionId: string;
  readonly entryType: 'credit';
  readonly amountCents: number;
}

export interface EscrowLedgerRepository {
  /**
   * Inserts a new ledger entry. Computes runningBalanceCents as
   * (previous balance for campaign) + amountCents.
   * MUST be called within an existing database transaction (client param).
   */
  createEntry(input: CreateLedgerEntryInput, client: PoolClient): Promise<EscrowLedgerEntry>;

  /**
   * Returns the current running balance (sum of all credit entries) for a campaign.
   */
  getRunningBalance(campaignId: string): Promise<number>;
}
