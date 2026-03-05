import type { Pool, PoolClient } from 'pg';
import type { TransactionClient } from '../../../shared/ports/transaction-port.js';
import { Contribution, type ContributionStatus } from '../../domain/contribution.js';
import type { ContributionRepository } from '../../ports/contribution-repository.js';

export class PgContributionRepository implements ContributionRepository {
  constructor(private readonly pool: Pool) {}

  async save(contribution: Contribution): Promise<void> {
    await this.pool.query(
      `INSERT INTO contributions (id, donor_id, campaign_id, amount_cents, status, gateway_reference, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        contribution.id,
        contribution.donorId,
        contribution.campaignId,
        contribution.amountCents,
        contribution.status,
        contribution.gatewayReference,
        contribution.createdAt,
        contribution.updatedAt,
      ],
    );
  }

  async update(contribution: Contribution, txClient?: TransactionClient): Promise<void> {
    const client = txClient
      ? ((txClient as unknown as { _pgClient: PoolClient })._pgClient)
      : this.pool;

    await client.query(
      `UPDATE contributions SET status = $1, gateway_reference = $2, updated_at = $3 WHERE id = $4`,
      [contribution.status, contribution.gatewayReference, contribution.updatedAt, contribution.id],
    );
  }

  async findById(id: string): Promise<Contribution | null> {
    const result = await this.pool.query(
      `SELECT * FROM contributions WHERE id = $1`,
      [id],
    );
    if (result.rows.length === 0) return null;
    return this.toDomain(result.rows[0]);
  }

  async findByDonorId(donorId: string): Promise<Contribution[]> {
    const result = await this.pool.query(
      `SELECT * FROM contributions WHERE donor_id = $1 ORDER BY created_at DESC`,
      [donorId],
    );
    return result.rows.map((row) => this.toDomain(row));
  }

  async findByCampaignId(campaignId: string): Promise<Contribution[]> {
    const result = await this.pool.query(
      `SELECT * FROM contributions WHERE campaign_id = $1 ORDER BY created_at DESC`,
      [campaignId],
    );
    return result.rows.map((row) => this.toDomain(row));
  }

  private toDomain(row: Record<string, unknown>): Contribution {
    return Contribution.reconstitute({
      id: row.id as string,
      donorId: row.donor_id as string,
      campaignId: row.campaign_id as string,
      amountCents: Number(row.amount_cents),
      status: row.status as ContributionStatus,
      gatewayReference: (row.gateway_reference as string | null) ?? null,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    });
  }
}
