import type { Pool } from 'pg';
import { KycTransitionConflictError } from '../../kyc/domain/errors/kyc-errors.js';
import { UserNotFoundError } from '../domain/errors/account-errors.js';
import { type UpdateProfileInput, User, type UserData } from '../domain/models/user.js';
import type { AccountStatus } from '../domain/value-objects/account-status.js';
import type { KycStatus } from '../domain/value-objects/kyc-status.js';
import type { NotificationPreferences } from '../domain/value-objects/notification-preferences.js';
import type { OnboardingStep } from '../domain/value-objects/onboarding-step.js';
import type { Role } from '../domain/value-objects/role.js';
import type { UserRepository } from '../ports/user-repository.port.js';

// DB row shape from postgres
interface UserRow {
  id: string;
  clerk_user_id: string;
  email: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  account_status: string;
  onboarding_completed: boolean;
  onboarding_step: string | null;
  roles: string[];
  notification_prefs: {
    campaign_updates: boolean;
    milestone_completions: boolean;
    contribution_confirmations: boolean;
    recommendations: boolean;
    security_alerts: boolean;
    platform_announcements: boolean;
  };
  kyc_status: string;
  last_seen_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function toNullableDate(value: Date | string | null): Date | null {
  if (value === null) return null;
  return value instanceof Date ? value : new Date(value);
}

function rowToDomain(row: UserRow): User {
  const notifPrefs = row.notification_prefs;

  const userData: UserData = {
    id: row.id,
    clerkUserId: row.clerk_user_id,
    email: row.email,
    displayName: row.display_name,
    bio: row.bio,
    avatarUrl: row.avatar_url,
    accountStatus: row.account_status as AccountStatus,
    onboardingCompleted: row.onboarding_completed,
    onboardingStep: row.onboarding_step as OnboardingStep | null,
    roles: row.roles as Role[],
    notificationPrefs: {
      campaignUpdates: notifPrefs.campaign_updates,
      milestoneCompletions: notifPrefs.milestone_completions,
      contributionConfirmations: notifPrefs.contribution_confirmations,
      recommendations: notifPrefs.recommendations,
      securityAlerts: true, // Always true — DB enforces this
      platformAnnouncements: notifPrefs.platform_announcements,
    },
    kycStatus: row.kyc_status as KycStatus,
    lastSeenAt: toNullableDate(row.last_seen_at),
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };

  return User.reconstitute(userData);
}

function notifPrefsToJsonb(prefs: NotificationPreferences): object {
  return {
    campaign_updates: prefs.campaignUpdates,
    milestone_completions: prefs.milestoneCompletions,
    contribution_confirmations: prefs.contributionConfirmations,
    recommendations: prefs.recommendations,
    security_alerts: true, // Always true
    platform_announcements: prefs.platformAnnouncements,
  };
}

export class PgUserRepository implements UserRepository {
  constructor(private readonly pool: Pool) {}

  async save(user: User): Promise<void> {
    await this.pool.query(
      `INSERT INTO users (
        id, clerk_user_id, email, display_name, bio, avatar_url,
        account_status, onboarding_completed, onboarding_step, roles,
        notification_prefs, kyc_status, last_seen_at, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        user.id,
        user.clerkUserId,
        user.email,
        user.displayName,
        user.bio,
        user.avatarUrl,
        user.accountStatus,
        user.onboardingCompleted,
        user.onboardingStep,
        user.roles,
        JSON.stringify(notifPrefsToJsonb(user.notificationPrefs)),
        user.kycStatus,
        user.lastSeenAt,
        user.createdAt,
        user.updatedAt,
      ],
    );
  }

  async upsertByClerkUserId(user: User): Promise<User> {
    const result = await this.pool.query<UserRow>(
      `INSERT INTO users (
        clerk_user_id, email, account_status, roles, notification_prefs, kyc_status, last_seen_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (clerk_user_id)
      DO UPDATE SET
        email          = EXCLUDED.email,
        last_seen_at   = NOW(),
        updated_at     = NOW()
      RETURNING *`,
      [
        user.clerkUserId,
        user.email,
        user.accountStatus,
        user.roles,
        JSON.stringify(notifPrefsToJsonb(user.notificationPrefs)),
        user.kycStatus,
      ],
    );

    const row = result.rows[0];
    if (!row) {
      throw new UserNotFoundError(user.clerkUserId);
    }
    return rowToDomain(row);
  }

  async findById(id: string): Promise<User | null> {
    const result = await this.pool.query<UserRow>('SELECT * FROM users WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    if (!row) return null;
    return rowToDomain(row);
  }

  async findByClerkUserId(clerkUserId: string): Promise<User | null> {
    const result = await this.pool.query<UserRow>('SELECT * FROM users WHERE clerk_user_id = $1', [
      clerkUserId,
    ]);
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    if (!row) return null;
    return rowToDomain(row);
  }

  async updateProfile(clerkUserId: string, input: UpdateProfileInput): Promise<User> {
    const result = await this.pool.query<UserRow>(
      `UPDATE users
       SET display_name         = $1,
           bio                  = $2,
           avatar_url           = $3,
           onboarding_completed = COALESCE($4, onboarding_completed),
           onboarding_step      = CASE WHEN $5::TEXT IS NULL AND $6 THEN onboarding_step ELSE $5::TEXT END,
           updated_at           = NOW()
       WHERE clerk_user_id = $7
       RETURNING *`,
      [
        input.displayName !== undefined ? input.displayName : null,
        input.bio !== undefined ? input.bio : null,
        input.avatarUrl !== undefined ? input.avatarUrl : null,
        input.onboardingCompleted,
        input.onboardingStep,
        input.onboardingStep === undefined, // true means "keep existing"
        clerkUserId,
      ],
    );

    const row = result.rows[0];
    if (!row) {
      throw new UserNotFoundError(clerkUserId);
    }
    return rowToDomain(row);
  }

  async updateNotificationPrefs(
    clerkUserId: string,
    prefs: NotificationPreferences,
  ): Promise<User> {
    const result = await this.pool.query<UserRow>(
      `UPDATE users
       SET notification_prefs = $1::JSONB,
           updated_at         = NOW()
       WHERE clerk_user_id    = $2
       RETURNING *`,
      [JSON.stringify(notifPrefsToJsonb(prefs)), clerkUserId],
    );

    const row = result.rows[0];
    if (!row) {
      throw new UserNotFoundError(clerkUserId);
    }
    return rowToDomain(row);
  }

  async updateAccountStatus(
    clerkUserId: string,
    status: AccountStatus,
    roles: Role[],
    email?: string,
  ): Promise<User> {
    const result = await this.pool.query<UserRow>(
      `UPDATE users
       SET account_status = $1,
           roles          = $2,
           email          = COALESCE($3, email),
           updated_at     = NOW()
       WHERE clerk_user_id = $4
       RETURNING *`,
      [status, roles, email ?? null, clerkUserId],
    );

    const row = result.rows[0];
    if (!row) {
      throw new UserNotFoundError(clerkUserId);
    }
    return rowToDomain(row);
  }

  async updateKycStatus(
    clerkUserId: string,
    fromStatus: KycStatus,
    toStatus: KycStatus,
  ): Promise<User> {
    const result = await this.pool.query<UserRow>(
      `UPDATE users
       SET    kyc_status = $2,
              updated_at = NOW()
       WHERE  clerk_user_id = $1
         AND  kyc_status   = $3
       RETURNING *`,
      [clerkUserId, toStatus, fromStatus],
    );

    if (result.rowCount === 0) {
      throw new KycTransitionConflictError();
    }

    const row = result.rows[0];
    if (!row) {
      throw new KycTransitionConflictError();
    }
    return rowToDomain(row);
  }

  async touchLastSeen(clerkUserId: string): Promise<void> {
    // No-op if user not found (idempotent)
    await this.pool.query(
      'UPDATE users SET last_seen_at = NOW(), updated_at = NOW() WHERE clerk_user_id = $1',
      [clerkUserId],
    );
  }

  async completeOnboarding(clerkUserId: string): Promise<User> {
    const result = await this.pool.query<UserRow>(
      `UPDATE users
       SET onboarding_completed = true,
           onboarding_step      = 'complete',
           updated_at           = NOW()
       WHERE clerk_user_id = $1
       RETURNING *`,
      [clerkUserId],
    );

    const row = result.rows[0];
    if (!row) {
      throw new UserNotFoundError(clerkUserId);
    }
    return rowToDomain(row);
  }
}
