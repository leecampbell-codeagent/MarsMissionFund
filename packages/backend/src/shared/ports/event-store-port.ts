export interface AppendEventInput {
  readonly eventType: string;
  readonly aggregateId: string;
  readonly aggregateType: string;
  readonly sequenceNumber: number;
  readonly correlationId: string;
  readonly sourceService: string;
  readonly payload: Record<string, unknown>;
}

export interface TransactionClient {
  readonly __brand: 'TransactionClient';
}

export interface EventStorePort {
  append(event: AppendEventInput, txClient?: TransactionClient): Promise<void>;
  getNextSequenceNumber(aggregateId: string, txClient?: TransactionClient): Promise<number>;
}

export interface TransactionPort {
  withTransaction<T>(fn: (txClient: TransactionClient) => Promise<T>): Promise<T>;
}
