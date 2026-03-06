import pg from 'pg';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PgUserRepository } from './pg-user-repository.js';

const { Pool } = pg;

// Use a dedicated test pool so we can tear down after each test
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Unique prefix to isolate test data from other runs
const TEST_CLERK_PREFIX = 'test_pg_repo_';

async function cleanupTestUsers(): Promise<void> {
  await pool.query(`DELETE FROM users WHERE clerk_id LIKE $1`, [`${TEST_CLERK_PREFIX}%`]);
}

describe('PgUserRepository', () => {
  let repo: PgUserRepository;

  beforeEach(async () => {
    repo = new PgUserRepository(pool);
    await cleanupTestUsers();
  });

  afterEach(async () => {
    await cleanupTestUsers();
  });

  // ---------------------------------------------------------------------------
  // findByClerkId
  // ---------------------------------------------------------------------------

  describe('findByClerkId', () => {
    it('returns null for unknown clerkUserId', async () => {
      const result = await repo.findByClerkId(`${TEST_CLERK_PREFIX}nonexistent`);
      expect(result).toBeNull();
    });

    it('returns user with roles for known clerkUserId', async () => {
      const id = crypto.randomUUID();
      const clerkId = `${TEST_CLERK_PREFIX}known_user`;

      await repo.upsertWithBackerRole({ id, clerkUserId: clerkId, email: 'known@test.example' });

      const result = await repo.findByClerkId(clerkId);

      expect(result).not.toBeNull();
      expect(result?.clerkUserId).toBe(clerkId);
      expect(result?.email).toBe('known@test.example');
      expect(result?.accountStatus).toBe('active');
      expect(result?.onboardingCompleted).toBe(false);
      expect(result?.displayName).toBeNull();
      expect(result?.avatarUrl).toBeNull();
      expect(result?.roles).toContain('backer');
      expect(result?.id).toBe(id);
    });
  });

  // ---------------------------------------------------------------------------
  // upsertWithBackerRole
  // ---------------------------------------------------------------------------

  describe('upsertWithBackerRole', () => {
    it('creates users row and user_roles row in one transaction', async () => {
      const id = crypto.randomUUID();
      const clerkId = `${TEST_CLERK_PREFIX}new_user`;

      const result = await repo.upsertWithBackerRole({
        id,
        clerkUserId: clerkId,
        email: 'new@test.example',
      });

      expect(result.id).toBe(id);
      expect(result.clerkUserId).toBe(clerkId);
      expect(result.email).toBe('new@test.example');
      expect(result.accountStatus).toBe('active');
      expect(result.roles).toContain('backer');
      expect(result.roles).toHaveLength(1);

      // Verify rows exist in DB
      const userRow = await pool.query('SELECT id FROM users WHERE clerk_id = $1', [clerkId]);
      expect(userRow.rows).toHaveLength(1);

      const roleRow = await pool.query(
        "SELECT role FROM user_roles WHERE user_id = $1 AND role = 'backer'",
        [id],
      );
      expect(roleRow.rows).toHaveLength(1);
    });

    it('is idempotent on second call — no duplicate rows, no error', async () => {
      const id = crypto.randomUUID();
      const clerkId = `${TEST_CLERK_PREFIX}idempotent_user`;

      await repo.upsertWithBackerRole({
        id,
        clerkUserId: clerkId,
        email: 'idempotent@test.example',
      });
      const result = await repo.upsertWithBackerRole({
        id,
        clerkUserId: clerkId,
        email: 'idempotent@test.example',
      });

      expect(result.id).toBe(id);
      expect(result.roles).toContain('backer');

      // Verify no duplicate users or roles
      const userCount = await pool.query('SELECT COUNT(*) FROM users WHERE clerk_id = $1', [
        clerkId,
      ]);
      expect(Number(userCount.rows[0]?.count)).toBe(1);

      const roleCount = await pool.query(
        "SELECT COUNT(*) FROM user_roles WHERE user_id = $1 AND role = 'backer'",
        [id],
      );
      expect(Number(roleCount.rows[0]?.count)).toBe(1);
    });

    it('updates email on conflict when email changes', async () => {
      const id = crypto.randomUUID();
      const clerkId = `${TEST_CLERK_PREFIX}email_update_user`;

      await repo.upsertWithBackerRole({ id, clerkUserId: clerkId, email: 'original@test.example' });
      const result = await repo.upsertWithBackerRole({
        id,
        clerkUserId: clerkId,
        email: 'updated@test.example',
      });

      expect(result.email).toBe('updated@test.example');

      const row = await pool.query('SELECT email FROM users WHERE clerk_id = $1', [clerkId]);
      expect(row.rows[0]?.email).toBe('updated@test.example');
    });
  });

  // ---------------------------------------------------------------------------
  // findById
  // ---------------------------------------------------------------------------

  describe('findById', () => {
    it('returns null for unknown userId', async () => {
      const result = await repo.findById(crypto.randomUUID());
      expect(result).toBeNull();
    });

    it('returns user with roles array for known userId', async () => {
      const id = crypto.randomUUID();
      const clerkId = `${TEST_CLERK_PREFIX}findbyid_user`;

      await repo.upsertWithBackerRole({ id, clerkUserId: clerkId, email: 'findbyid@test.example' });

      const result = await repo.findById(id);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(id);
      expect(result?.clerkUserId).toBe(clerkId);
      expect(result?.email).toBe('findbyid@test.example');
      expect(Array.isArray(result?.roles)).toBe(true);
      expect(result?.roles).toContain('backer');
    });
  });

  // ---------------------------------------------------------------------------
  // updateProfile
  // ---------------------------------------------------------------------------

  describe('updateProfile', () => {
    it('sets display_name and bio; updatedAt is newer', async () => {
      const id = crypto.randomUUID();
      const clerkId = `${TEST_CLERK_PREFIX}update_profile_user`;

      const created = await repo.upsertWithBackerRole({
        id,
        clerkUserId: clerkId,
        email: 'profile@test.example',
      });

      // Small delay to ensure updatedAt differs
      await new Promise((r) => setTimeout(r, 10));

      const updated = await repo.updateProfile(id, {
        displayName: 'Yuki Tanaka',
        bio: 'Aerospace engineer with 12 years of experience.',
      });

      expect(updated.displayName).toBe('Yuki Tanaka');
      expect(updated.bio).toBe('Aerospace engineer with 12 years of experience.');
      expect(updated.updatedAt.getTime()).toBeGreaterThan(created.updatedAt.getTime());
    });

    it('clears display_name and bio when null is passed', async () => {
      const id = crypto.randomUUID();
      const clerkId = `${TEST_CLERK_PREFIX}clear_profile_user`;

      await repo.upsertWithBackerRole({ id, clerkUserId: clerkId, email: 'clear@test.example' });
      await repo.updateProfile(id, { displayName: 'To Be Cleared', bio: 'Some bio text' });

      const cleared = await repo.updateProfile(id, { displayName: null, bio: null });
      expect(cleared.displayName).toBeNull();
      expect(cleared.bio).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // updateNotificationPreferences
  // ---------------------------------------------------------------------------

  describe('updateNotificationPreferences', () => {
    it('persists all five keys; resolved preferences returned', async () => {
      const id = crypto.randomUUID();
      const clerkId = `${TEST_CLERK_PREFIX}notif_prefs_user`;

      await repo.upsertWithBackerRole({ id, clerkUserId: clerkId, email: 'notif@test.example' });

      const updated = await repo.updateNotificationPreferences(id, {
        campaign_updates: false,
        milestone_completions: true,
        contribution_confirmations: false,
        new_recommendations: true,
        platform_announcements: true,
      });

      expect(updated.notificationPreferences.campaign_updates).toBe(false);
      expect(updated.notificationPreferences.milestone_completions).toBe(true);
      expect(updated.notificationPreferences.contribution_confirmations).toBe(false);
      expect(updated.notificationPreferences.new_recommendations).toBe(true);
      expect(updated.notificationPreferences.platform_announcements).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // completeOnboarding
  // ---------------------------------------------------------------------------

  describe('completeOnboarding', () => {
    it('sets onboarding_completed=true, adds roles, updates profile in one transaction', async () => {
      const id = crypto.randomUUID();
      const clerkId = `${TEST_CLERK_PREFIX}complete_onboarding_user`;

      await repo.upsertWithBackerRole({
        id,
        clerkUserId: clerkId,
        email: 'onboarding@test.example',
      });

      const result = await repo.completeOnboarding(id, {
        step: 3,
        roles: ['backer', 'creator'],
        displayName: 'Mission Pilot',
        bio: 'Flying to Mars since 2026.',
      });

      expect(result.onboardingCompleted).toBe(true);
      expect(result.onboardingStep).toBe(3);
      expect(result.displayName).toBe('Mission Pilot');
      expect(result.bio).toBe('Flying to Mars since 2026.');
      expect(result.roles).toContain('backer');
      expect(result.roles).toContain('creator');
    });

    it('is idempotent — re-running does not throw or duplicate roles', async () => {
      const id = crypto.randomUUID();
      const clerkId = `${TEST_CLERK_PREFIX}idempotent_onboarding_user`;

      await repo.upsertWithBackerRole({ id, clerkUserId: clerkId, email: 'idem@test.example' });

      await repo.completeOnboarding(id, { step: 3, roles: ['backer'] });
      const result = await repo.completeOnboarding(id, { step: 3, roles: ['backer'] });

      expect(result.onboardingCompleted).toBe(true);

      const roleCount = await pool.query(
        "SELECT COUNT(*) FROM user_roles WHERE user_id = $1 AND role = 'backer'",
        [id],
      );
      expect(Number(roleCount.rows[0]?.count)).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // saveOnboardingStep
  // ---------------------------------------------------------------------------

  describe('saveOnboardingStep', () => {
    it('updates onboarding_step without setting onboarding_completed', async () => {
      const id = crypto.randomUUID();
      const clerkId = `${TEST_CLERK_PREFIX}save_step_user`;

      await repo.upsertWithBackerRole({ id, clerkUserId: clerkId, email: 'step@test.example' });

      await repo.saveOnboardingStep(id, 2);

      const row = await pool.query(
        'SELECT onboarding_step, onboarding_completed FROM users WHERE id = $1',
        [id],
      );
      expect(row.rows[0]?.onboarding_step).toBe(2);
      expect(row.rows[0]?.onboarding_completed).toBe(false);
    });
  });
});
