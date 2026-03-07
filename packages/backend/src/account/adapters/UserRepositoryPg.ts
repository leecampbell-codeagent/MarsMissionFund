import type { Pool } from 'pg';
import type { KycStatus } from '../domain/KycStatus';
import type { Role } from '../domain/Role';
import { User } from '../domain/User';
import type { UserRepository } from '../ports/UserRepository';

export class UserRepositoryPg implements UserRepository {
  constructor(private readonly pool: Pool) {}

  async findByClerkId(clerkId: string): Promise<User | null> {
    const result = await this.pool.query('SELECT * FROM users WHERE clerk_id = $1', [clerkId]);
    if (result.rows.length === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  async findById(id: string): Promise<User | null> {
    const result = await this.pool.query('SELECT * FROM users WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  async upsert(user: User): Promise<User> {
    const result = await this.pool.query(
      `INSERT INTO users (
        id, clerk_id, email, display_name, avatar_url, bio, roles,
        kyc_status, onboarding_completed, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (clerk_id) DO UPDATE SET
        email = EXCLUDED.email,
        updated_at = NOW()
      RETURNING *`,
      [
        user.id,
        user.clerkId,
        user.email,
        user.displayName,
        user.avatarUrl,
        user.bio,
        user.roles,
        user.kycStatus,
        user.onboardingCompleted,
        user.createdAt,
        user.updatedAt,
      ],
    );
    return this.mapRow(result.rows[0]);
  }

  async updateProfile(
    id: string,
    fields: { displayName?: string | null; bio?: string | null; avatarUrl?: string | null },
  ): Promise<User | null> {
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if ('displayName' in fields) {
      setClauses.push(`display_name = $${paramIndex}`);
      values.push(fields.displayName);
      paramIndex++;
    }
    if ('bio' in fields) {
      setClauses.push(`bio = $${paramIndex}`);
      values.push(fields.bio);
      paramIndex++;
    }
    if ('avatarUrl' in fields) {
      setClauses.push(`avatar_url = $${paramIndex}`);
      values.push(fields.avatarUrl);
      paramIndex++;
    }

    if (setClauses.length === 0) {
      return this.findById(id);
    }

    setClauses.push(`updated_at = NOW()`);
    values.push(id);

    const result = await this.pool.query(
      `UPDATE users SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values,
    );

    if (result.rows.length === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  async updateRoles(id: string, roles: string[]): Promise<User | null> {
    const result = await this.pool.query(
      'UPDATE users SET roles = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [roles, id],
    );
    if (result.rows.length === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  private mapRow(row: Record<string, unknown>): User {
    return User.reconstitute({
      id: row.id as string,
      clerkId: row.clerk_id as string,
      email: row.email as string,
      displayName: (row.display_name as string | null) ?? null,
      avatarUrl: (row.avatar_url as string | null) ?? null,
      bio: (row.bio as string | null) ?? null,
      roles: row.roles as Role[],
      kycStatus: row.kyc_status as KycStatus,
      onboardingCompleted: row.onboarding_completed as boolean,
      createdAt: row.created_at as Date,
      updatedAt: row.updated_at as Date,
    });
  }
}
