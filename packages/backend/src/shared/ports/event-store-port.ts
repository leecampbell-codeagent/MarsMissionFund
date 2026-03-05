import type { TransactionClient } from './transaction-port.js';

export interface DomainEvent {
  readonly eventType: string;
  readonly aggregateId: string;
  readonly aggregateType: string;
  readonly sequenceNumber: number;
  readonly correlationId: string;
  readonly sourceService: string;
  readonly payload: Record<string, unknown>;
}

/**
 * Port for appending domain events to the event store.
 * Events and aggregate updates must be in the same transaction.
 */
export interface EventStorePort {
  getNextSequenceNumber(aggregateId: string, txClient: TransactionClient): Promise<number>;
  append(event: DomainEvent, txClient: TransactionClient): Promise<void>;
}
