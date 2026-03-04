import { Account, type AccountStatus } from '../../domain/account.js';
import type { AccountRepository, WebhookAccountInput } from '../../ports/account-repository.js';

export class InMemoryAccountRepository implements AccountRepository {
  private readonly accounts: Map<string, Account> = new Map();

  async findByClerkUserId(clerkUserId: string): Promise<Account | null> {
    for (const account of this.accounts.values()) {
      if (account.clerkUserId === clerkUserId) {
        return account;
      }
    }
    return null;
  }

  async save(account: Account): Promise<void> {
    // Emulate ON CONFLICT (clerk_user_id) DO UPDATE behaviour
    const existing = await this.findByClerkUserId(account.clerkUserId);
    if (existing) {
      // Update the existing account with new email/displayName
      const updated = Account.reconstitute({
        id: existing.id,
        clerkUserId: existing.clerkUserId,
        email: account.email,
        displayName: account.displayName,
        status: existing.status,
        roles: existing.roles,
        onboardingCompleted: existing.onboardingCompleted,
        createdAt: existing.createdAt,
        updatedAt: new Date(),
      });
      this.accounts.set(updated.id, updated);
    } else {
      this.accounts.set(account.id, account);
    }
  }

  async upsertFromWebhook(input: WebhookAccountInput): Promise<void> {
    const existing = await this.findByClerkUserId(input.clerkUserId);
    if (existing) {
      const updated = Account.reconstitute({
        id: existing.id,
        clerkUserId: existing.clerkUserId,
        email: input.email,
        displayName: input.displayName,
        status: existing.status,
        roles: existing.roles,
        onboardingCompleted: existing.onboardingCompleted,
        createdAt: existing.createdAt,
        updatedAt: new Date(),
      });
      this.accounts.set(updated.id, updated);
    } else {
      const account = Account.create({
        clerkUserId: input.clerkUserId,
        email: input.email,
        displayName: input.displayName,
      });
      this.accounts.set(account.id, account);
    }
  }

  async updateStatusByClerkUserId(clerkUserId: string, status: AccountStatus): Promise<void> {
    const existing = await this.findByClerkUserId(clerkUserId);
    if (existing) {
      const updated = Account.reconstitute({
        id: existing.id,
        clerkUserId: existing.clerkUserId,
        email: existing.email,
        displayName: existing.displayName,
        status,
        roles: existing.roles,
        onboardingCompleted: existing.onboardingCompleted,
        createdAt: existing.createdAt,
        updatedAt: new Date(),
      });
      this.accounts.set(updated.id, updated);
    }
    // If not found, no-op (same as SQL UPDATE WHERE affecting zero rows)
  }

  /** Helper for tests: get all stored accounts */
  getAll(): Account[] {
    return [...this.accounts.values()];
  }

  /** Helper for tests: clear all accounts */
  clear(): void {
    this.accounts.clear();
  }

  /** Helper for tests: seed an account directly */
  seed(account: Account): void {
    this.accounts.set(account.id, account);
  }
}
