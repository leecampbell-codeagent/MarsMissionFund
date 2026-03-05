/**
 * Opaque transaction client passed to repositories during a transaction.
 * The concrete implementation is infrastructure-specific (e.g., a pg PoolClient).
 */
export interface TransactionClient {
  readonly _brand: 'TransactionClient';
}

/**
 * Port for executing database operations within a single atomic transaction.
 * Application services use this to ensure contribution + ledger writes are atomic.
 */
export interface TransactionPort {
  withTransaction<T>(fn: (client: TransactionClient) => Promise<T>): Promise<T>;
}
