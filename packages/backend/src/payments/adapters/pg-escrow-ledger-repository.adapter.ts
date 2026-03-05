import type { Pool, PoolClient } from 'pg';
import type {
  CreateLedgerEntryInput,
  EscrowLedgerEntry,
  EscrowLedgerRepository,
} from '../ports/escrow-ledger-repository.port.js';

interface EscrowLedgerRow {
  id: string;
  campaign_id: string;
  contribution_id: string;
  entry_type: string;
  amount_cents: string; // BIGINT comes as string from pg (G-024)
  running_balance_cents: string; // BIGINT comes as string from pg
  created_at: Date;
}

function rowToEntry(row: EscrowLedgerRow): EscrowLedgerEntry {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    contributionId: row.contribution_id,
    entryType: row.entry_type as 'credit',
    amountCents: parseInt(row.amount_cents, 10),
    runningBalanceCents: parseInt(row.running_balance_cents, 10),
    createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
  };
}

export class PgEscrowLedgerRepository implements EscrowLedgerRepository {
  constructor(private readonly pool: Pool) {}

  async createEntry(input: CreateLedgerEntryInput, client: PoolClient): Promise<EscrowLedgerEntry> {
    // Step 1: get previous running balance for this campaign (within same transaction)
    const balanceResult = await client.query<{ prev_balance: string }>(
      `SELECT COALESCE(MAX(running_balance_cents), 0) AS prev_balance
       FROM escrow_ledger
       WHERE campaign_id = $1`,
      [input.campaignId],
    );

    const prevBalance = parseInt(balanceResult.rows[0]?.prev_balance ?? '0', 10);
    const runningBalance = prevBalance + input.amountCents;

    // Step 2: insert new entry with computed running balance
    const result = await client.query<EscrowLedgerRow>(
      `INSERT INTO escrow_ledger
        (campaign_id, contribution_id, entry_type, amount_cents, running_balance_cents)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [input.campaignId, input.contributionId, input.entryType, input.amountCents, runningBalance],
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error('Failed to create escrow ledger entry — no row returned');
    }
    return rowToEntry(row);
  }

  async getRunningBalance(campaignId: string): Promise<number> {
    const result = await this.pool.query<{ balance: string }>(
      `SELECT COALESCE(MAX(running_balance_cents), 0) AS balance
       FROM escrow_ledger
       WHERE campaign_id = $1`,
      [campaignId],
    );
    return parseInt(result.rows[0]?.balance ?? '0', 10);
  }
}
