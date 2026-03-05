import type { TransactionClient } from '../../../shared/ports/transaction-port.js';
import type { ProcessedWebhookEventRepository } from '../../ports/processed-webhook-event-repository.js';

export class InMemoryProcessedWebhookEventRepository implements ProcessedWebhookEventRepository {
  private readonly processedIds = new Set<string>();

  async hasBeenProcessed(eventId: string): Promise<boolean> {
    return this.processedIds.has(eventId);
  }

  async markAsProcessed(
    eventId: string,
    _eventType: string,
    _txClient?: TransactionClient,
  ): Promise<void> {
    this.processedIds.add(eventId);
  }

  /** Helper for tests: clear all processed events */
  clear(): void {
    this.processedIds.clear();
  }
}
