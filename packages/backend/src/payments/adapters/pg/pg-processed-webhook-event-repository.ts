import type { Pool, PoolClient } from 'pg';
import type { TransactionClient } from '../../../shared/ports/transaction-port.js';
import type { ProcessedWebhookEventRepository } from '../../ports/processed-webhook-event-repository.js';

export class PgProcessedWebhookEventRepository implements ProcessedWebhookEventRepository {
  constructor(private readonly pool: Pool) {}

  async hasBeenProcessed(eventId: string): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT 1 FROM processed_webhook_events WHERE event_id = $1`,
      [eventId],
    );
    return result.rows.length > 0;
  }

  async markAsProcessed(
    eventId: string,
    eventType: string,
    txClient?: TransactionClient,
  ): Promise<void> {
    const client = txClient
      ? ((txClient as unknown as { _pgClient: PoolClient })._pgClient)
      : this.pool;

    // ON CONFLICT DO NOTHING for idempotency
    await client.query(
      `INSERT INTO processed_webhook_events (event_id, event_type) VALUES ($1, $2)
       ON CONFLICT (event_id) DO NOTHING`,
      [eventId, eventType],
    );
  }
}
