import type { Pool, PoolClient } from 'pg';
import type { TransactionClient, TransactionPort } from '../../ports/transaction-port.js';

interface PgTransactionClient extends TransactionClient {
  readonly _brand: 'TransactionClient';
  readonly _pgClient: PoolClient;
}

export class PgTransactionAdapter implements TransactionPort {
  constructor(private readonly pool: Pool) {}

  async withTransaction<T>(fn: (client: TransactionClient) => Promise<T>): Promise<T> {
    const pgClient = await this.pool.connect();
    try {
      await pgClient.query('BEGIN');

      const txClient: PgTransactionClient = {
        _brand: 'TransactionClient',
        _pgClient: pgClient,
      };

      const result = await fn(txClient);
      await pgClient.query('COMMIT');
      return result;
    } catch (error) {
      await pgClient.query('ROLLBACK');
      throw error;
    } finally {
      pgClient.release();
    }
  }
}
