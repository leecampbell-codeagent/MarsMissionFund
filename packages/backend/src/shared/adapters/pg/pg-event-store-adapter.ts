import type { Pool, PoolClient } from 'pg';
import type {
  AppendEventInput,
  EventStorePort,
  TransactionClient,
  TransactionPort,
} from '../../ports/event-store-port.js';

// PoolClient wrapped as a branded TransactionClient to keep pg out of domain/application code
interface PgTransactionClient extends TransactionClient {
  readonly __brand: 'TransactionClient';
  readonly pgClient: PoolClient;
}

function isPgTransactionClient(client: TransactionClient): client is PgTransactionClient {
  return 'pgClient' in client;
}

export class PgEventStoreAdapter implements EventStorePort {
  constructor(private readonly pool: Pool) {}

  async append(event: AppendEventInput, txClient?: TransactionClient): Promise<void> {
    const executor = txClient && isPgTransactionClient(txClient) ? txClient.pgClient : this.pool;
    await executor.query(
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

  async getNextSequenceNumber(aggregateId: string, txClient?: TransactionClient): Promise<number> {
    const executor = txClient && isPgTransactionClient(txClient) ? txClient.pgClient : this.pool;
    const result = await executor.query<{ next_seq: string }>(
      `SELECT COALESCE(MAX(sequence_number), 0) + 1 AS next_seq FROM events WHERE aggregate_id = $1`,
      [aggregateId],
    );
    return Number(result.rows[0]?.next_seq ?? 1);
  }
}

export class PgTransactionAdapter implements TransactionPort {
  constructor(private readonly pool: Pool) {}

  async withTransaction<T>(fn: (txClient: TransactionClient) => Promise<T>): Promise<T> {
    const pgClient = await this.pool.connect();
    try {
      await pgClient.query('BEGIN');
      const txClient: PgTransactionClient = {
        __brand: 'TransactionClient',
        pgClient,
      };
      const result = await fn(txClient);
      await pgClient.query('COMMIT');
      return result;
    } catch (err) {
      await pgClient.query('ROLLBACK');
      throw err;
    } finally {
      pgClient.release();
    }
  }
}
