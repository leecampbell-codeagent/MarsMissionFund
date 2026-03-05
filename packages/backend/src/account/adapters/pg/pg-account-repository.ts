import type { Pool, PoolClient } from 'pg';
import type { TransactionClient } from '../../../shared/ports/event-store-port.js';
import {
  Account,
  type AccountRole,
  type AccountStatus,
  type NotificationPreferences,
  type OnboardingStep,
} from '../../domain/account.js';
import type { AccountRepository, WebhookAccountInput } from '../../ports/account-repository.js';

interface PgTransactionClient extends TransactionClient {
  readonly __brand: 'TransactionClient';
  readonly pgClient: PoolClient;
}

function isPgTransactionClient(client: TransactionClient): client is PgTransactionClient {
  return 'pgClient' in client;
}

export class PgAccountRepository implements AccountRepository {
  constructor(private readonly pool: Pool) {}

  async findByClerkUserId(clerkUserId: string): Promise<Account | null> {
    const result = await this.pool.query(
      `SELECT id, clerk_user_id, email, display_name, bio, avatar_url, status, roles,
              onboarding_completed, onboarding_step, notification_preferences, created_at, updated_at
       FROM accounts
       WHERE clerk_user_id = $1`,
      [clerkUserId],
    );
    if (result.rows.length === 0) {
      return null;
    }
    return this.toDomain(result.rows[0] as Record<string, unknown>);
  }

  async findById(id: string): Promise<Account | null> {
    const result = await this.pool.query(
      `SELECT id, clerk_user_id, email, display_name, bio, avatar_url, status, roles,
              onboarding_completed, onboarding_step, notification_preferences, created_at, updated_at
       FROM accounts
       WHERE id = $1`,
      [id],
    );
    if (result.rows.length === 0) {
      return null;
    }
    return this.toDomain(result.rows[0] as Record<string, unknown>);
  }

  async save(account: Account): Promise<void> {
    await this.pool.query(
      `INSERT INTO accounts (id, clerk_user_id, email, display_name, bio, avatar_url, status, roles,
                             onboarding_completed, onboarding_step, notification_preferences)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (clerk_user_id) DO UPDATE SET
         email = EXCLUDED.email,
         display_name = EXCLUDED.display_name,
         updated_at = NOW()`,
      [
        account.id,
        account.clerkUserId,
        account.email,
        account.displayName,
        account.bio,
        account.avatarUrl,
        account.status,
        account.roles as string[],
        account.onboardingCompleted,
        account.onboardingStep,
        JSON.stringify(account.notificationPreferences),
      ],
    );
  }

  async update(account: Account, txClient?: TransactionClient): Promise<void> {
    const executor = txClient && isPgTransactionClient(txClient) ? txClient.pgClient : this.pool;
    await executor.query(
      `UPDATE accounts SET
         display_name = $2,
         bio = $3,
         avatar_url = $4,
         roles = $5,
         onboarding_completed = $6,
         onboarding_step = $7,
         notification_preferences = $8,
         updated_at = NOW()
       WHERE id = $1`,
      [
        account.id,
        account.displayName,
        account.bio,
        account.avatarUrl,
        account.roles as string[],
        account.onboardingCompleted,
        account.onboardingStep,
        JSON.stringify(account.notificationPreferences),
      ],
    );
  }

  async upsertFromWebhook(input: WebhookAccountInput): Promise<void> {
    await this.pool.query(
      `INSERT INTO accounts (clerk_user_id, email, display_name, status, roles)
       VALUES ($1, $2, $3, 'active', '{backer}')
       ON CONFLICT (clerk_user_id) DO UPDATE SET
         email = EXCLUDED.email,
         display_name = COALESCE(accounts.display_name, EXCLUDED.display_name),
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
    const rawPrefs = row.notification_preferences as Record<string, unknown> | null;
    const notificationPreferences: NotificationPreferences = rawPrefs
      ? {
          campaign_updates: Boolean(rawPrefs.campaign_updates),
          milestone_completions: Boolean(rawPrefs.milestone_completions),
          contribution_confirmations: Boolean(rawPrefs.contribution_confirmations),
          new_campaign_recommendations: Boolean(rawPrefs.new_campaign_recommendations),
          security_alerts: true,
          platform_announcements: Boolean(rawPrefs.platform_announcements),
        }
      : {
          campaign_updates: true,
          milestone_completions: true,
          contribution_confirmations: true,
          new_campaign_recommendations: true,
          security_alerts: true,
          platform_announcements: false,
        };

    return Account.reconstitute({
      id: row.id as string,
      clerkUserId: row.clerk_user_id as string,
      email: row.email as string,
      displayName: (row.display_name as string | null) ?? null,
      bio: (row.bio as string | null) ?? null,
      avatarUrl: (row.avatar_url as string | null) ?? null,
      status: row.status as AccountStatus,
      roles: row.roles as string[] as AccountRole[],
      onboardingCompleted: row.onboarding_completed as boolean,
      onboardingStep: (row.onboarding_step as OnboardingStep) ?? 'welcome',
      notificationPreferences,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    });
  }
}
