import type { Pool } from 'pg';
import type { KycStatus } from '../../account/domain/value-objects/kyc-status.js';
import type {
  CreateKycAuditEventInput,
  KycAuditEvent,
  KycAuditRepositoryPort,
} from '../ports/kyc-audit-repository.port.js';

interface KycAuditRow {
  id: string;
  user_id: string | null;
  actor_clerk_user_id: string;
  action: string;
  previous_status: string | null;
  new_status: string;
  trigger_reason: string | null;
  metadata: Record<string, unknown> | null;
  created_at: Date | string;
}

function rowToDomain(row: KycAuditRow): KycAuditEvent {
  return {
    id: row.id,
    userId: row.user_id,
    actorClerkUserId: row.actor_clerk_user_id,
    action: row.action as 'kyc.status.change',
    previousStatus: row.previous_status as KycStatus | null,
    newStatus: row.new_status as KycStatus,
    triggerReason: row.trigger_reason,
    metadata: row.metadata,
    createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
  };
}

export class PgKycAuditRepository implements KycAuditRepositoryPort {
  constructor(private readonly pool: Pool) {}

  async createEvent(input: CreateKycAuditEventInput): Promise<KycAuditEvent> {
    const result = await this.pool.query<KycAuditRow>(
      `INSERT INTO kyc_audit_events
         (user_id, actor_clerk_user_id, action, previous_status, new_status, trigger_reason, metadata)
       VALUES
         ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        input.userId,
        input.actorClerkUserId,
        input.action,
        input.previousStatus ?? null,
        input.newStatus,
        input.triggerReason ?? null,
        input.metadata ? JSON.stringify(input.metadata) : null,
      ],
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error('Failed to insert KYC audit event');
    }
    return rowToDomain(row);
  }

  async findByUserId(userId: string): Promise<KycAuditEvent[]> {
    const result = await this.pool.query<KycAuditRow>(
      `SELECT * FROM kyc_audit_events
       WHERE user_id = $1
       ORDER BY created_at ASC`,
      [userId],
    );

    return result.rows.map(rowToDomain);
  }
}
