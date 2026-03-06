import pg from 'pg';
import pino from 'pino';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AlreadyVerifiedError } from '../../domain/errors.js';
import { StubKycAdapter } from './stub-kyc-adapter.js';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const logger = pino({ level: 'silent' });

const TEST_PREFIX = 'test_kyc_stub_';

async function cleanupTestData(): Promise<void> {
  await pool.query(
    `DELETE FROM kyc_verifications
     WHERE user_id IN (SELECT id FROM users WHERE clerk_id LIKE $1)`,
    [`${TEST_PREFIX}%`],
  );
  await pool.query(`DELETE FROM users WHERE clerk_id LIKE $1`, [`${TEST_PREFIX}%`]);
}

async function createTestUser(): Promise<string> {
  const id = crypto.randomUUID();
  const clerkId = `${TEST_PREFIX}${crypto.randomUUID()}`;
  await pool.query(
    `INSERT INTO users (id, clerk_id, email, account_status)
     VALUES ($1, $2, $3, 'active')`,
    [id, clerkId, `kyc-test-${id}@test.example`],
  );
  return id;
}

describe('StubKycAdapter', () => {
  let adapter: StubKycAdapter;
  let userId: string;

  beforeEach(async () => {
    adapter = new StubKycAdapter(pool, logger);
    await cleanupTestData();
    userId = await createTestUser();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  it('getStatus returns null when no row exists', async () => {
    const result = await adapter.getStatus(userId);
    expect(result).toBeNull();
  });

  it('submit creates a new row with status "verified" and non-null verifiedAt', async () => {
    const result = await adapter.submit({ userId, documentType: 'passport' });

    expect(result.userId).toBe(userId);
    expect(result.status).toBe('verified');
    expect(result.verifiedAt).not.toBeNull();
  });

  it('getStatus returns "verified" after submit', async () => {
    await adapter.submit({ userId, documentType: 'passport' });

    const status = await adapter.getStatus(userId);
    expect(status).not.toBeNull();
    expect(status?.status).toBe('verified');
  });

  it('submit on already-verified user throws AlreadyVerifiedError', async () => {
    await adapter.submit({ userId, documentType: 'passport' });

    await expect(adapter.submit({ userId, documentType: 'national_id' })).rejects.toBeInstanceOf(
      AlreadyVerifiedError,
    );
  });

  it('submit is idempotent when called from pending state (treated as allowed re-submission)', async () => {
    // Manually insert a pending row
    await pool.query(
      `INSERT INTO kyc_verifications (id, user_id, status, provider_reference, verified_at)
       VALUES (gen_random_uuid(), $1, 'pending', NULL, NULL)`,
      [userId],
    );

    // Should succeed and transition to verified
    const result = await adapter.submit({ userId, documentType: 'drivers_licence' });
    expect(result.status).toBe('verified');
    expect(result.verifiedAt).not.toBeNull();
  });

  it('verifiedAt is a Date object (not string) in the returned KycVerification', async () => {
    const result = await adapter.submit({ userId, documentType: 'passport' });

    expect(result.verifiedAt).toBeInstanceOf(Date);
  });
});
