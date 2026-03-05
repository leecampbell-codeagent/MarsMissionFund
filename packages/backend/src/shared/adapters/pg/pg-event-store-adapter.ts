import type { Pool } from 'pg';
import type { AppendEventInput, EventStorePort } from '../../ports/event-store-port.js';

export class PgEventStoreAdapter implements EventStorePort {
  constructor(private readonly pool: Pool) {}

  async append(event: AppendEventInput): Promise<void> {
    await this.pool.query(
      `INSERT INTO events (event_type, aggregate_id, aggregate_type, sequence_number, correlation_id, source_service, payload)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        event.eventType,
        event.aggregateId,
        event.aggregateType,
        event.sequenceNumber,
        event.correlationId,
        event.sourceService,
        JSON.stringify(event.payload),
      ],
    );
  }

  async getNextSequenceNumber(aggregateId: string): Promise<number> {
    const result = await this.pool.query<{ next_seq: string }>(
      `SELECT COALESCE(MAX(sequence_number), 0) + 1 AS next_seq FROM events WHERE aggregate_id = $1`,
      [aggregateId],
    );
    return Number(result.rows[0]?.next_seq ?? 1);
  }
}
