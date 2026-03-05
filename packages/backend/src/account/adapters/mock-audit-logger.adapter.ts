import type { AuditEntry, AuditLoggerPort } from '../ports/audit-logger.port.js';

/**
 * In-memory audit logger for tests.
 * Exposes `entries` for test assertions.
 */
export class MockAuditLogger implements AuditLoggerPort {
  readonly entries: AuditEntry[] = [];

  async log(entry: AuditEntry): Promise<void> {
    this.entries.push(entry);
  }
}
