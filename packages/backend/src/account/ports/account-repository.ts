import type { Account, AccountStatus } from '../domain/account.js';
import type { TransactionClient } from '../../shared/ports/event-store-port.js';

export interface WebhookAccountInput {
  readonly clerkUserId: string;
  readonly email: string;
  readonly displayName: string | null;
}

export interface AccountRepository {
  findByClerkUserId(clerkUserId: string): Promise<Account | null>;
  findById(id: string): Promise<Account | null>;
  save(account: Account): Promise<void>;
  update(account: Account, txClient?: TransactionClient): Promise<void>;
  upsertFromWebhook(input: WebhookAccountInput): Promise<void>;
  updateStatusByClerkUserId(clerkUserId: string, status: AccountStatus): Promise<void>;
}
