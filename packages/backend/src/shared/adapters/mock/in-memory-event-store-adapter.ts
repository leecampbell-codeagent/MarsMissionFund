import type { DomainEvent, EventStorePort } from '../../ports/event-store-port.js';
import type { TransactionClient } from '../../ports/transaction-port.js';

/**
 * In-memory event store adapter for tests.
 * Stores events in memory without persistence.
 */
export class InMemoryEventStoreAdapter implements EventStorePort {
  readonly events: DomainEvent[] = [];

  async getNextSequenceNumber(aggregateId: string, _txClient: TransactionClient): Promise<number> {
    const count = this.events.filter((e) => e.aggregateId === aggregateId).length;
    return count + 1;
  }

  async append(event: DomainEvent, _txClient: TransactionClient): Promise<void> {
    this.events.push(event);
  }

  /** Helper for tests: clear all events */
  clear(): void {
    this.events.length = 0;
  }
}
