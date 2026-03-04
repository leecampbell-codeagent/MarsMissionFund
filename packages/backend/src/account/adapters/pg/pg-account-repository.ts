import type { Pool } from 'pg';
import { Account, type AccountStatus } from '../../domain/account.js';
import type { AccountRepository, WebhookAccountInput } from '../../ports/account-repository.js';

export class PgAccountRepository implements AccountRepository {
  constructor(private readonly pool: Pool) {}

  async findByClerkUserId(clerkUserId: string): Promise<Account | null> {
    const result = await this.pool.query(
      `SELECT id, clerk_user_id, email, display_name, status, roles, onboarding_completed, created_at, updated_at
       FROM accounts
       WHERE clerk_user_id = $1`,
      [clerkUserId],
    );
    if (result.rows.length === 0) {
      return null;
    }
    return this.toDomain(result.rows[0] as Record<string, unknown>);
  }

  async save(account: Account): Promise<void> {
    await this.pool.query(
      `INSERT INTO accounts (id, clerk_user_id, email, display_name, status, roles, onboarding_completed)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (clerk_user_id) DO UPDATE SET
         email = EXCLUDED.email,
         display_name = EXCLUDED.display_name,
         updated_at = NOW()`,
      [
        account.id,
        account.clerkUserId,
        account.email,
        account.displayName,
        account.status,
        account.roles as string[],
        account.onboardingCompleted,
      ],
    );
  }

  async upsertFromWebhook(input: WebhookAccountInput): Promise<void> {
    await this.pool.query(
      `INSERT INTO accounts (clerk_user_id, email, display_name, status, roles)
       VALUES ($1, $2, $3, 'active', '{backer}')
       ON CONFLICT (clerk_user_id) DO UPDATE SET
         email = EXCLUDED.email,
         display_name = EXCLUDED.display_name,
         updated_at = NOW()`,
      [input.clerkUserId, input.email, input.displayName],
    );
  }

  async updateStatusByClerkUserId(clerkUserId: string, status: AccountStatus): Promise<void> {
    await this.pool.query(
      `UPDATE accounts SET status = $2, updated_at = NOW() WHERE clerk_user_id = $1`,
      [clerkUserId, status],
    );
  }

  private toDomain(row: Record<string, unknown>): Account {
    return Account.reconstitute({
      id: row['id'] as string,
      clerkUserId: row['clerk_user_id'] as string,
      email: row['email'] as string,
      displayName: (row['display_name'] as string | null) ?? null,
      status: row['status'] as AccountStatus,
      roles: row['roles'] as string[],
      onboardingCompleted: row['onboarding_completed'] as boolean,
      createdAt: new Date(row['created_at'] as string),
      updatedAt: new Date(row['updated_at'] as string),
    });
  }
}
