import type { TransactionClient } from '../../../shared/ports/transaction-port.js';
import type { EscrowLedgerEntry } from '../../domain/escrow-ledger-entry.js';
import type { EscrowLedgerRepository } from '../../ports/escrow-ledger-repository.js';

const CREDIT_TYPES = new Set(['contribution', 'interest_credit']);
const DEBIT_TYPES = new Set(['disbursement', 'refund', 'interest_debit']);

export class InMemoryEscrowLedgerRepository implements EscrowLedgerRepository {
  private readonly entries: EscrowLedgerEntry[] = [];

  async appendEntry(entry: EscrowLedgerEntry, _txClient?: TransactionClient): Promise<void> {
    this.entries.push(entry);
  }

  async getBalanceCents(campaignId: string): Promise<number> {
    let balance = 0;
    for (const entry of this.entries) {
      if (entry.campaignId !== campaignId) continue;
      if (CREDIT_TYPES.has(entry.entryType)) {
        balance += entry.amountCents;
      } else if (DEBIT_TYPES.has(entry.entryType)) {
        balance -= entry.amountCents;
      }
    }
    return balance;
  }

  async getEntriesForCampaign(campaignId: string): Promise<EscrowLedgerEntry[]> {
    return this.entries.filter((e) => e.campaignId === campaignId);
  }

  /** Helper for tests: get all entries */
  getAll(): EscrowLedgerEntry[] {
    return [...this.entries];
  }

  /** Helper for tests: clear all entries */
  clear(): void {
    this.entries.length = 0;
  }
}
