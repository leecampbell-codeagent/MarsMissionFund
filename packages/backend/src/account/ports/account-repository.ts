import { Account, AccountStatus } from '../domain/account.js';

export interface WebhookAccountInput {
  readonly clerkUserId: string;
  readonly email: string;
  readonly displayName: string | null;
}

export interface AccountRepository {
  findByClerkUserId(clerkUserId: string): Promise<Account | null>;
  save(account: Account): Promise<void>;
  upsertFromWebhook(input: WebhookAccountInput): Promise<void>;
  updateStatusByClerkUserId(clerkUserId: string, status: AccountStatus): Promise<void>;
}
