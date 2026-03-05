import type { PoolClient } from 'pg';
import type {
  CreateLedgerEntryInput,
  EscrowLedgerEntry,
  EscrowLedgerRepository,
} from '../ports/escrow-ledger-repository.port.js';

/**
 * In-memory implementation for tests.
 * Exposed `entries` array allows test assertions.
 */
export class InMemoryEscrowLedgerRepository implements EscrowLedgerRepository {
  readonly entries: EscrowLedgerEntry[] = [];

  async createEntry(
    input: CreateLedgerEntryInput,
    _client: PoolClient,
  ): Promise<EscrowLedgerEntry> {
    // Compute running balance from existing entries for this campaign
    const prevBalance = this.entries
      .filter((e) => e.campaignId === input.campaignId)
      .reduce((sum, e) => sum + e.amountCents, 0);

    const entry: EscrowLedgerEntry = {
      id: crypto.randomUUID(),
      campaignId: input.campaignId,
      contributionId: input.contributionId,
      entryType: input.entryType,
      amountCents: input.amountCents,
      runningBalanceCents: prevBalance + input.amountCents,
      createdAt: new Date(),
    };
    this.entries.push(entry);
    return entry;
  }

  async getRunningBalance(campaignId: string): Promise<number> {
    const campaignEntries = this.entries.filter((e) => e.campaignId === campaignId);
    if (campaignEntries.length === 0) return 0;
    return campaignEntries[campaignEntries.length - 1]?.runningBalanceCents ?? 0;
  }
}
