import type { TransactionClient } from '../../shared/ports/transaction-port.js';

export interface ProcessedWebhookEventRepository {
  hasBeenProcessed(eventId: string): Promise<boolean>;
  markAsProcessed(eventId: string, eventType: string, txClient?: TransactionClient): Promise<void>;
}
