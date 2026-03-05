import type { TransactionClient } from '../../shared/ports/transaction-port.js';
import type { EscrowLedgerEntry } from '../domain/escrow-ledger-entry.js';

export interface EscrowLedgerRepository {
  appendEntry(entry: EscrowLedgerEntry, txClient?: TransactionClient): Promise<void>;
  getBalanceCents(campaignId: string): Promise<number>;
  getEntriesForCampaign(campaignId: string): Promise<EscrowLedgerEntry[]>;
}
