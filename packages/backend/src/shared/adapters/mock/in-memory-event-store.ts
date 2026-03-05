import type {
  AppendEventInput,
  EventStorePort,
  TransactionClient,
} from '../../ports/event-store-port.js';

export class InMemoryEventStore implements EventStorePort {
  private readonly eventsByAggregate = new Map<string, AppendEventInput[]>();

  async append(event: AppendEventInput, _txClient?: TransactionClient): Promise<void> {
    const existing = this.eventsByAggregate.get(event.aggregateId) ?? [];
    this.eventsByAggregate.set(event.aggregateId, [...existing, event]);
  }

  async getNextSequenceNumber(aggregateId: string, _txClient?: TransactionClient): Promise<number> {
    const events = this.eventsByAggregate.get(aggregateId) ?? [];
    return events.length + 1;
  }

  /** Returns events for a specific aggregate. */
  getEvents(aggregateId: string): AppendEventInput[] {
    return this.eventsByAggregate.get(aggregateId) ?? [];
  }

  /** Returns all events across all aggregates. */
  getAllEvents(): AppendEventInput[] {
    const all: AppendEventInput[] = [];
    for (const events of this.eventsByAggregate.values()) {
      all.push(...events);
    }
    return all;
  }

  /** Resets all stored events. */
  clear(): void {
    this.eventsByAggregate.clear();
  }
}
