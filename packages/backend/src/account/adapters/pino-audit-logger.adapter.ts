import type { Logger } from 'pino';
import type { AuditEntry, AuditLoggerPort } from '../ports/audit-logger.port.js';

/**
 * Writes audit entries as structured JSON log events via pino.
 * A persistent audit table is out of scope for feat-001.
 */
export class PinoAuditLoggerAdapter implements AuditLoggerPort {
  constructor(private readonly logger: Logger) {}

  async log(entry: AuditEntry): Promise<void> {
    this.logger.info(
      {
        audit: true,
        timestamp: entry.timestamp.toISOString(),
        actorClerkUserId: entry.actorClerkUserId,
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        ...(entry.metadata ? { metadata: entry.metadata } : {}),
      },
      `Audit: ${entry.action}`,
    );
  }
}




























