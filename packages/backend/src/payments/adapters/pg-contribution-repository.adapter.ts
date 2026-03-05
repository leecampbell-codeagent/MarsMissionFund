import type { Pool, PoolClient } from 'pg';
import { Contribution } from '../domain/models/contribution.js';
import type { ContributionStatus } from '../domain/value-objects/contribution-status.js';
import type { ContributionRepository } from '../ports/contribution-repository.port.js';

interface ContributionRow {
  id: string;
  donor_user_id: string;
  campaign_id: string;
  amount_cents: string; // BIGINT comes as string from pg (G-024)
  payment_token: string;
  status: string;
  transaction_ref: string | null;
  failure_reason: string | null;
  idempotency_key: string | null;
  created_at: Date;
  updated_at: Date;
}

function rowToContribution(row: ContributionRow): Contribution {
  return Contribution.reconstitute({
    id: row.id,
    donorUserId: row.donor_user_id,
    campaignId: row.campaign_id,
    amountCents: parseInt(row.amount_cents, 10), // G-024: BIGINT comes as string
    paymentToken: row.payment_token,
    status: row.status as ContributionStatus,
    transactionRef: row.transaction_ref,
    failureReason: row.failure_reason,
    idempotencyKey: row.idempotency_key,
    createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
    updatedAt: row.updated_at instanceof Date ? row.updated_at : new Date(row.updated_at),
  });
}

export class PgContributionRepository implements ContributionRepository {
  constructor(private readonly pool: Pool) {}

  async save(contribution: Contribution): Promise<Contribution> {
    const result = await this.pool.query<ContributionRow>(
      `INSERT INTO contributions
        (donor_user_id, campaign_id, amount_cents, payment_token, status, idempotency_key)
      VALUES ($1, $2, $3, $4, 'pending_capture', $5)
      RETURNING *`,
      [
        contribution.donorUserId,
        contribution.campaignId,
        contribution.amountCents,
        contribution.paymentToken,
        contribution.idempotencyKey,
      ],
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error('Failed to save contribution — no row returned');
    }
    return rowToContribution(row);
  }

  async findById(id: string): Promise<Contribution | null> {
    const result = await this.pool.query<ContributionRow>(
      'SELECT * FROM contributions WHERE id = $1',
      [id],
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    if (!row) return null;
    return rowToContribution(row);
  }

  async findByIdForDonor(id: string, donorUserId: string): Promise<Contribution | null> {
    const result = await this.pool.query<ContributionRow>(
      'SELECT * FROM contributions WHERE id = $1 AND donor_user_id = $2',
      [id, donorUserId],
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    if (!row) return null;
    return rowToContribution(row);
  }

  async updateStatus(
    contributionId: string,
    status: string,
    transactionRef: string | null,
    failureReason: string | null,
    client?: PoolClient,
  ): Promise<Contribution> {
    const executor = client ?? this.pool;
    const result = await executor.query<ContributionRow>(
      `UPDATE contributions
       SET status = $2, transaction_ref = $3, failure_reason = $4, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [contributionId, status, transactionRef, failureReason],
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error(`Contribution ${contributionId} not found for status update`);
    }
    return rowToContribution(row);
  }

  async existsDuplicate(
    donorUserId: string,
    campaignId: string,
    amountCents: number,
    windowSeconds: number,
  ): Promise<boolean> {
    const result = await this.pool.query<{ duplicate_exists: boolean }>(
      `SELECT EXISTS (
        SELECT 1
        FROM contributions
        WHERE donor_user_id = $1
          AND campaign_id   = $2
          AND amount_cents  = $3
          AND status != 'failed'
          AND created_at > NOW() - ($4 * INTERVAL '1 second')
      ) AS duplicate_exists`,
      [donorUserId, campaignId, amountCents, windowSeconds],
    );

    return result.rows[0]?.duplicate_exists ?? false;
  }

  async listByDonorForCampaign(
    donorUserId: string,
    campaignId: string,
    limit: number,
    offset: number,
  ): Promise<Contribution[]> {
    const result = await this.pool.query<ContributionRow>(
      `SELECT * FROM contributions
       WHERE donor_user_id = $1 AND campaign_id = $2
       ORDER BY created_at DESC
       LIMIT $3 OFFSET $4`,
      [donorUserId, campaignId, limit, offset],
    );
    return result.rows.map(rowToContribution);
  }
}
