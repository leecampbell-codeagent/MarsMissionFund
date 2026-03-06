import type { Pool, PoolClient } from 'pg';
import type { AccountStatus } from '../../domain/models/user.js';
import { User } from '../../domain/models/user.js';
import type { UserRepository, UserSyncInput } from '../../ports/user-repository.js';

interface UserRow {
  id: string;
  clerk_id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  account_status: string;
  onboarding_completed: boolean;
  created_at: Date;
  updated_at: Date;
}

interface RoleRow {
  role: string;
}

function toUser(row: UserRow, roles: string[]): User {
  return User.reconstitute(
    {
      id: row.id,
      clerkUserId: row.clerk_id,
      email: row.email,
      displayName: row.display_name,
      avatarUrl: row.avatar_url,
      accountStatus: row.account_status as AccountStatus,
      onboardingCompleted: row.onboarding_completed,
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
      'SELECT id, clerk_id, email, display_name, avatar_url, account_status, onboarding_completed, created_at, updated_at FROM users WHERE clerk_id = $1',
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
         RETURNING id, clerk_id, email, display_name, avatar_url, account_status, onboarding_completed, created_at, updated_at`,
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
      'SELECT id, clerk_id, email, display_name, avatar_url, account_status, onboarding_completed, created_at, updated_at FROM users WHERE id = $1',
      [userId],
    );
    const row = result.rows[0];
    if (!row) return null;

    const roles = await fetchRoles(this.pool, row.id);
    return toUser(row, roles);
  }
}
