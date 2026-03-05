import type { Pool } from 'pg';
import type {
  ContributionAuditEvent,
  ContributionAuditRepository,
  CreateAuditEventInput,
} from '../ports/contribution-audit-repository.port.js';

interface AuditEventRow {
  id: string;
  contribution_id: string;
  campaign_id: string;
  donor_user_id: string;
  previous_status: string | null;
  new_status: string;
  amount_cents: string; // BIGINT comes as string from pg
  event_type: string;
  created_at: Date;
}

function rowToEvent(row: AuditEventRow): ContributionAuditEvent {
  return {
    id: row.id,
    contributionId: row.contribution_id,
    campaignId: row.campaign_id,
    donorUserId: row.donor_user_id,
    previousStatus: row.previous_status,
    newStatus: row.new_status,
    amountCents: parseInt(row.amount_cents, 10),
    eventType: row.event_type,
    createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
  };
}

export class PgContributionAuditRepository implements ContributionAuditRepository {
  constructor(private readonly pool: Pool) {}

  async createEvent(input: CreateAuditEventInput): Promise<ContributionAuditEvent> {
    const result = await this.pool.query<AuditEventRow>(
      `INSERT INTO contribution_audit_events
        (contribution_id, campaign_id, donor_user_id, previous_status, new_status, amount_cents, event_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        input.contributionId,
        input.campaignId,
        input.donorUserId,
        input.previousStatus,
        input.newStatus,
        input.amountCents,
        input.eventType,
      ],
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error('Failed to create audit event — no row returned');
    }
    return rowToEvent(row);
  }
}
