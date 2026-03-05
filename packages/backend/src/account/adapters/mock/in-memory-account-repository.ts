import type { TransactionClient } from '../../../shared/ports/event-store-port.js';
import { Account, type AccountStatus } from '../../domain/account.js';
import type { AccountRepository, WebhookAccountInput } from '../../ports/account-repository.js';

export class InMemoryAccountRepository implements AccountRepository {
  private readonly accounts = new Map<string, Account>();

  findByClerkUserId(clerkUserId: string): Promise<Account | null> {
    for (const account of this.accounts.values()) {
      if (account.clerkUserId === clerkUserId) {
        return Promise.resolve(account);
      }
    }
    return Promise.resolve(null);
  }

  findById(id: string): Promise<Account | null> {
    return Promise.resolve(this.accounts.get(id) ?? null);
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
        bio: existing.bio,
        avatarUrl: existing.avatarUrl,
        status: existing.status,
        roles: existing.roles,
        onboardingCompleted: existing.onboardingCompleted,
        onboardingStep: existing.onboardingStep,
        notificationPreferences: existing.notificationPreferences,
        createdAt: existing.createdAt,
        updatedAt: new Date(),
      });
      this.accounts.set(updated.id, updated);
    } else {
      this.accounts.set(account.id, account);
    }
  }

  async update(account: Account, _txClient?: TransactionClient): Promise<void> {
    this.accounts.set(account.id, account);
  }

  async upsertFromWebhook(input: WebhookAccountInput): Promise<void> {
    const existing = await this.findByClerkUserId(input.clerkUserId);
    if (existing) {
      // Only update display name if current value is null (COALESCE behaviour)
      const updated = Account.reconstitute({
        id: existing.id,
        clerkUserId: existing.clerkUserId,
        email: input.email,
        displayName: existing.displayName ?? input.displayName,
        bio: existing.bio,
        avatarUrl: existing.avatarUrl,
        status: existing.status,
        roles: existing.roles,
        onboardingCompleted: existing.onboardingCompleted,
        onboardingStep: existing.onboardingStep,
        notificationPreferences: existing.notificationPreferences,
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
        bio: existing.bio,
        avatarUrl: existing.avatarUrl,
        status,
        roles: existing.roles,
        onboardingCompleted: existing.onboardingCompleted,
        onboardingStep: existing.onboardingStep,
        notificationPreferences: existing.notificationPreferences,
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
