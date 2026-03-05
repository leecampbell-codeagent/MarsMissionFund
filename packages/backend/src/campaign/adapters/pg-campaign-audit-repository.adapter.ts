import type { Pool } from 'pg';
import type { CampaignStatus } from '../domain/value-objects/campaign-status.js';
import type {
  CampaignAuditAction,
  CampaignAuditEvent,
  CampaignAuditRepository,
  CreateCampaignAuditEventInput,
} from '../ports/campaign-audit-repository.port.js';

interface CampaignAuditRow {
  id: string;
  campaign_id: string;
  actor_user_id: string | null;
  actor_clerk_user_id: string;
  action: string;
  previous_status: string | null;
  new_status: string;
  rationale: string | null;
  metadata: Record<string, unknown> | null;
  created_at: Date | string;
}

function rowToDomain(row: CampaignAuditRow): CampaignAuditEvent {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    actorUserId: row.actor_user_id,
    actorClerkUserId: row.actor_clerk_user_id,
    action: row.action as CampaignAuditAction,
    previousStatus: (row.previous_status as CampaignStatus) ?? null,
    newStatus: row.new_status as CampaignStatus,
    rationale: row.rationale,
    metadata: row.metadata,
    createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
  };
}

export class PgCampaignAuditRepository implements CampaignAuditRepository {
  constructor(private readonly pool: Pool) {}

  async createEvent(input: CreateCampaignAuditEventInput): Promise<CampaignAuditEvent> {
    const result = await this.pool.query<CampaignAuditRow>(
      `INSERT INTO campaign_audit_events
         (campaign_id, actor_user_id, actor_clerk_user_id, action, previous_status, new_status, rationale, metadata)
       VALUES
         ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        input.campaignId,
        input.actorUserId,
        input.actorClerkUserId,
        input.action,
        input.previousStatus ?? null,
        input.newStatus,
        input.rationale ?? null,
        input.metadata ? JSON.stringify(input.metadata) : null,
      ],
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error('Failed to create campaign audit event');
    }

    return rowToDomain(row);
  }

  async findByCampaignId(campaignId: string): Promise<CampaignAuditEvent[]> {
    const result = await this.pool.query<CampaignAuditRow>(
      `SELECT * FROM campaign_audit_events
       WHERE campaign_id = $1
       ORDER BY created_at ASC`,
      [campaignId],
    );

    return result.rows.map(rowToDomain);
  }
}
