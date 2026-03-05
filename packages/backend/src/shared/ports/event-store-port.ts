export interface AppendEventInput {
  readonly eventType: string;
  readonly aggregateId: string;
  readonly aggregateType: string;
  readonly sequenceNumber: number;
  readonly correlationId: string;
  readonly sourceService: string;
  readonly payload: Record<string, unknown>;
}

export interface EventStorePort {
  append(event: AppendEventInput): Promise<void>;
  getNextSequenceNumber(aggregateId: string): Promise<number>;
}
