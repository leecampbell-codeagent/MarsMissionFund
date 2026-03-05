import type { Pool, PoolClient } from 'pg';
import type { TransactionClient } from '../../../shared/ports/transaction-port.js';
import { EscrowLedgerEntry, type EscrowEntryType } from '../../domain/escrow-ledger-entry.js';
import type { EscrowLedgerRepository } from '../../ports/escrow-ledger-repository.js';

export class PgEscrowLedgerRepository implements EscrowLedgerRepository {
  constructor(private readonly pool: Pool) {}

  async appendEntry(entry: EscrowLedgerEntry, txClient?: TransactionClient): Promise<void> {
    const client = txClient
      ? ((txClient as unknown as { _pgClient: PoolClient })._pgClient)
      : this.pool;

    await client.query(
      `INSERT INTO escrow_ledger (id, campaign_id, entry_type, amount_cents, contribution_id, disbursement_id, description, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        entry.id,
        entry.campaignId,
        entry.entryType,
        entry.amountCents,
        entry.contributionId,
        entry.disbursementId,
        entry.description,
        entry.createdAt,
      ],
    );
  }

  async getBalanceCents(campaignId: string): Promise<number> {
    const result = await this.pool.query<{ balance_cents: string }>(
      `SELECT
        COALESCE(SUM(CASE WHEN entry_type IN ('contribution', 'interest_credit') THEN amount_cents ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN entry_type IN ('disbursement', 'refund', 'interest_debit') THEN amount_cents ELSE 0 END), 0)
        AS balance_cents
       FROM escrow_ledger
       WHERE campaign_id = $1`,
      [campaignId],
    );
    return Number(result.rows[0]?.balance_cents ?? 0);
  }

  async getEntriesForCampaign(campaignId: string): Promise<EscrowLedgerEntry[]> {
    const result = await this.pool.query(
      `SELECT * FROM escrow_ledger WHERE campaign_id = $1 ORDER BY created_at ASC`,
      [campaignId],
    );
    return result.rows.map((row) => this.toDomain(row));
  }

  private toDomain(row: Record<string, unknown>): EscrowLedgerEntry {
    return EscrowLedgerEntry.reconstitute({
      id: row.id as string,
      campaignId: row.campaign_id as string,
      entryType: row.entry_type as EscrowEntryType,
      amountCents: Number(row.amount_cents),
      contributionId: (row.contribution_id as string | null) ?? null,
      disbursementId: (row.disbursement_id as string | null) ?? null,
      description: (row.description as string | null) ?? null,
      createdAt: new Date(row.created_at as string),
    });
  }
}
