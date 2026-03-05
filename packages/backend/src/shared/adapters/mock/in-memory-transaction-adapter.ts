import type { TransactionClient, TransactionPort } from '../../ports/transaction-port.js';

/**
 * In-memory transaction adapter for tests.
 * Executes the callback without real DB transaction semantics — sufficient for unit/integration tests.
 */
export class InMemoryTransactionAdapter implements TransactionPort {
  async withTransaction<T>(fn: (client: TransactionClient) => Promise<T>): Promise<T> {
    const mockClient = { _brand: 'TransactionClient' as const };
    return await fn(mockClient);
  }
}
