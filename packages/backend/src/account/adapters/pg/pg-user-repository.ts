import type { Pool, PoolClient } from 'pg';
import type { AccountStatus } from '../../domain/models/user.js';
import { User } from '../../domain/models/user.js';
import type { NotificationPreferences } from '../../domain/value-objects/notification-preferences.js';
import { resolveNotificationPreferences } from '../../domain/value-objects/notification-preferences.js';
import type { UserRepository, UserSyncInput } from '../../ports/user-repository.js';

interface UserRow {
  id: string;
  clerk_id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  account_status: string;
  onboarding_completed: boolean;
  onboarding_step: number | null;
  notification_preferences: Record<string, boolean>;
  created_at: Date;
  updated_at: Date;
}

interface RoleRow {
  role: string;
}

const SELECT_COLUMNS = `id, clerk_id, email, display_name, avatar_url, bio,
          account_status, onboarding_completed, onboarding_step,
          notification_preferences, created_at, updated_at`;

function toUser(row: UserRow, roles: string[]): User {
  return User.reconstitute(
    {
      id: row.id,
      clerkUserId: row.clerk_id,
      email: row.email,
      displayName: row.display_name,
      avatarUrl: row.avatar_url,
      bio: row.bio,
      accountStatus: row.account_status as AccountStatus,
      onboardingCompleted: row.onboarding_completed,
      onboardingStep: row.onboarding_step,
      notificationPreferences: resolveNotificationPreferences(
        row.notification_preferences as Partial<NotificationPreferences>,
      ),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    },
    roles,
  );
}

async function fetchRoles(client: PoolClient | Pool, userId: string): Promise<string[]> {
  const result = await client.query<RoleRow>('SELECT role FROM user_roles WHERE user_id = $1', [
    userId,
  ]);
  return result.rows.map((r) => r.role);
}

export class PgUserRepository implements UserRepository {
  constructor(private readonly pool: Pool) {}

  async findByClerkId(clerkUserId: string): Promise<User | null> {
    const result = await this.pool.query<UserRow>(
      `SELECT ${SELECT_COLUMNS} FROM users WHERE clerk_id = $1`,
      [clerkUserId],
    );
    const row = result.rows[0];
    if (!row) return null;

    const roles = await fetchRoles(this.pool, row.id);
    return toUser(row, roles);
  }

  async upsertWithBackerRole(input: UserSyncInput): Promise<User> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const upsertResult = await client.query<UserRow>(
        `INSERT INTO users (id, clerk_id, email, account_status)
         VALUES ($1, $2, $3, 'active')
         ON CONFLICT (clerk_id) DO UPDATE
           SET email = EXCLUDED.email,
               updated_at = NOW()
         RETURNING ${SELECT_COLUMNS}`,
        [input.id, input.clerkUserId, input.email],
      );

      const row = upsertResult.rows[0];
      if (!row) {
        throw new Error('Upsert did not return a row');
      }

      const roleId = crypto.randomUUID();
      await client.query(
        `INSERT INTO user_roles (id, user_id, role, assigned_by)
         VALUES ($1, $2, 'backer', NULL)
         ON CONFLICT (user_id, role) DO NOTHING`,
        [roleId, row.id],
      );

      const rolesResult = await client.query<RoleRow>(
        'SELECT role FROM user_roles WHERE user_id = $1',
        [row.id],
      );

      await client.query('COMMIT');

      const roles = rolesResult.rows.map((r) => r.role);
      return toUser(row, roles);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async findById(userId: string): Promise<User | null> {
    const result = await this.pool.query<UserRow>(
      `SELECT ${SELECT_COLUMNS} FROM users WHERE id = $1`,
      [userId],
    );
    const row = result.rows[0];
    if (!row) return null;

    const roles = await fetchRoles(this.pool, row.id);
    return toUser(row, roles);
  }

  async updateProfile(
    userId: string,
    fields: { displayName?: string | null; bio?: string | null },
  ): Promise<User> {
    // Build a direct SET query — set exactly the provided fields, using NULL to clear.
    // For fields not provided (undefined), keep the existing DB value via COALESCE.
    const displayNameProvided = 'displayName' in fields;
    const bioProvided = 'bio' in fields;

    const params: (string | null)[] = [userId];
    const sets: string[] = ['updated_at = NOW()'];

    if (displayNameProvided) {
      params.push(fields.displayName ?? null);
      sets.push(`display_name = $${params.length}`);
    } else {
      sets.push('display_name = COALESCE(display_name, display_name)');
    }

    if (bioProvided) {
      params.push(fields.bio ?? null);
      sets.push(`bio = $${params.length}`);
    } else {
      sets.push('bio = COALESCE(bio, bio)');
    }

    const result = await this.pool.query<UserRow>(
      `UPDATE users SET ${sets.join(', ')} WHERE id = $1 RETURNING ${SELECT_COLUMNS}`,
      params,
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error('User not found');
    }

    const roles = await fetchRoles(this.pool, row.id);
    return toUser(row, roles);
  }

  async updateNotificationPreferences(
    userId: string,
    prefs: NotificationPreferences,
  ): Promise<User> {
    const result = await this.pool.query<UserRow>(
      `UPDATE users
       SET notification_preferences = $2,
           updated_at = NOW()
       WHERE id = $1
       RETURNING ${SELECT_COLUMNS}`,
      [userId, prefs],
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error('User not found');
    }

    const roles = await fetchRoles(this.pool, row.id);
    return toUser(row, roles);
  }

  async completeOnboarding(
    userId: string,
    input: {
      step: number;
      roles: string[];
      displayName?: string | null;
      bio?: string | null;
    },
  ): Promise<User> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      for (const role of input.roles) {
        const roleId = crypto.randomUUID();
        await client.query(
          `INSERT INTO user_roles (id, user_id, role, assigned_by)
           VALUES ($1, $2, $3, NULL)
           ON CONFLICT (user_id, role) DO NOTHING`,
          [roleId, userId, role],
        );
      }

      const updateResult = await client.query<UserRow>(
        `UPDATE users
         SET display_name = $2,
             bio = $3,
             onboarding_completed = true,
             onboarding_step = $4,
             updated_at = NOW()
         WHERE id = $1
         RETURNING ${SELECT_COLUMNS}`,
        [userId, input.displayName ?? null, input.bio ?? null, input.step],
      );

      const row = updateResult.rows[0];
      if (!row) {
        throw new Error('User not found');
      }

      const rolesResult = await client.query<RoleRow>(
        'SELECT role FROM user_roles WHERE user_id = $1',
        [userId],
      );

      await client.query('COMMIT');

      const roles = rolesResult.rows.map((r) => r.role);
      return toUser(row, roles);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async saveOnboardingStep(userId: string, step: number): Promise<void> {
    await this.pool.query(
      'UPDATE users SET onboarding_step = $2, updated_at = NOW() WHERE id = $1',
      [userId, step],
    );
  }
}
