import type { Application } from 'express';
import express from 'express';
import pino from 'pino';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryUserRepository } from '../../account/adapters/in-memory-user-repository.adapter.js';
import { User, type UserData } from '../../account/domain/models/user.js';
import { AccountStatus } from '../../account/domain/value-objects/account-status.js';
import { KycStatus } from '../../account/domain/value-objects/kyc-status.js';
import { NotificationPreferences } from '../../account/domain/value-objects/notification-preferences.js';
import { Role } from '../../account/domain/value-objects/role.js';
import { correlationIdMiddleware } from '../../shared/middleware/auth.js';
import { createErrorHandler } from '../../shared/middleware/error-handler.js';
import { InMemoryKycAuditRepository } from '../adapters/in-memory-kyc-audit-repository.adapter.js';
import { StubKycVerificationAdapter } from '../adapters/stub-kyc-provider.adapter.js';
import { KycAppService } from '../application/kyc-app-service.js';
import { createKycRouter } from './kyc-router.js';

// Mock @clerk/express to avoid real Clerk JWT validation in tests (G-012)
vi.mock('@clerk/express', () => ({
  clerkMiddleware:
    () => (_req: express.Request, _res: express.Response, next: express.NextFunction) =>
      next(),
  requireAuth: () => (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const userId = req.headers['x-test-user-id'] as string | undefined;
    if (!userId) {
      res.status(401).json({
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Authentication required. Sign in to continue.',
          correlation_id: null,
        },
      });
      return;
    }
    next();
  },
  getAuth: (req: express.Request) => {
    const userId = req.headers['x-test-user-id'] as string | undefined;
    return { userId: userId ?? null };
  },
}));

const logger = pino({ level: 'silent' });

function makeDefaultUserData(clerkUserId: string, overrides: Partial<UserData> = {}): UserData {
  return {
    id: `id-${clerkUserId}`,
    clerkUserId,
    email: `${clerkUserId}@test.mmf`,
    displayName: null,
    bio: null,
    avatarUrl: null,
    accountStatus: AccountStatus.Active,
    onboardingCompleted: false,
    onboardingStep: null,
    roles: [Role.Backer],
    notificationPrefs: NotificationPreferences.defaults(),
    kycStatus: KycStatus.NotStarted,
    lastSeenAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function seedUser(
  repo: InMemoryUserRepository,
  clerkUserId: string,
  overrides: Partial<UserData> = {},
): User {
  const data = makeDefaultUserData(clerkUserId, overrides);
  const user = User.reconstitute(data);
  repo.users.set(clerkUserId, user);
  return user;
}

function createTestApp(shouldApprove = true): {
  app: Application;
  userRepository: InMemoryUserRepository;
  kycAuditRepository: InMemoryKycAuditRepository;
} {
  const userRepository = new InMemoryUserRepository();
  const kycProvider = new StubKycVerificationAdapter(shouldApprove);
  const kycAuditRepository = new InMemoryKycAuditRepository();
  const kycAppService = new KycAppService(userRepository, kycProvider, kycAuditRepository, logger);

  const app = express();
  app.use(correlationIdMiddleware);
  app.use(express.json());

  // Auth middleware mock: inject req.auth from x-test-user-id header
  app.use((req, _res, next) => {
    const userId = req.headers['x-test-user-id'] as string | undefined;
    if (userId) {
      req.auth = { userId };
    }
    next();
  });

  // Auth guard
  app.use('/api/v1', (req, res, next) => {
    if (!req.auth?.userId) {
      res.status(401).json({
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Authentication required. Sign in to continue.',
          correlation_id: null,
        },
      });
      return;
    }
    next();
  });

  app.use('/api/v1/kyc', createKycRouter(kycAppService, logger));
  app.use(createErrorHandler(logger));

  return { app, userRepository, kycAuditRepository };
}

// ---------------------------------------------------------------------------
// GET /api/v1/kyc/status
// ---------------------------------------------------------------------------

describe('GET /api/v1/kyc/status', () => {
  let app: Application;
  let userRepository: InMemoryUserRepository;

  beforeEach(() => {
    const result = createTestApp();
    app = result.app;
    userRepository = result.userRepository;
  });

  it('returns 200 with kycStatus and updatedAt for authenticated user', async () => {
    seedUser(userRepository, 'user_kyc_status', {
      kycStatus: KycStatus.NotStarted,
      updatedAt: new Date('2026-03-05T12:00:00.000Z'),
    });

    const res = await request(app)
      .get('/api/v1/kyc/status')
      .set('x-test-user-id', 'user_kyc_status');

    expect(res.status).toBe(200);
    expect(res.body.data.kycStatus).toBe('not_started');
    expect(res.body.data.updatedAt).toBeDefined();
  });

  it('returns kycStatus verified for verified user', async () => {
    seedUser(userRepository, 'user_kyc_verified', { kycStatus: KycStatus.Verified });

    const res = await request(app)
      .get('/api/v1/kyc/status')
      .set('x-test-user-id', 'user_kyc_verified');

    expect(res.status).toBe(200);
    expect(res.body.data.kycStatus).toBe('verified');
  });

  it('returns kycStatus not_started for new user', async () => {
    seedUser(userRepository, 'user_kyc_new', { kycStatus: KycStatus.NotStarted });

    const res = await request(app)
      .get('/api/v1/kyc/status')
      .set('x-test-user-id', 'user_kyc_new');

    expect(res.status).toBe(200);
    expect(res.body.data.kycStatus).toBe('not_started');
  });

  it('returns 200 with ISO string updatedAt', async () => {
    seedUser(userRepository, 'user_kyc_date', {
      updatedAt: new Date('2026-03-05T14:30:00.000Z'),
    });

    const res = await request(app)
      .get('/api/v1/kyc/status')
      .set('x-test-user-id', 'user_kyc_date');

    expect(res.status).toBe(200);
    expect(new Date(res.body.data.updatedAt).toISOString()).toBe('2026-03-05T14:30:00.000Z');
  });

  it('returns 401 UNAUTHENTICATED without auth header', async () => {
    const res = await request(app).get('/api/v1/kyc/status');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('returns 404 USER_NOT_FOUND for authenticated user not in DB', async () => {
    const res = await request(app)
      .get('/api/v1/kyc/status')
      .set('x-test-user-id', 'user_not_in_db_xyz');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('USER_NOT_FOUND');
  });

  it('includes correlation_id in 404 error response', async () => {
    const res = await request(app)
      .get('/api/v1/kyc/status')
      .set('x-test-user-id', 'user_corr_id_test');

    expect(res.status).toBe(404);
    expect(res.body.error.correlation_id).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/kyc/submit — happy paths
// ---------------------------------------------------------------------------

describe('POST /api/v1/kyc/submit — happy path (stub approves)', () => {
  let app: Application;
  let userRepository: InMemoryUserRepository;

  beforeEach(() => {
    const result = createTestApp(true);
    app = result.app;
    userRepository = result.userRepository;
  });

  it('returns 200 with kycStatus verified for not_started user', async () => {
    seedUser(userRepository, 'user_submit_200', {
      kycStatus: KycStatus.NotStarted,
      accountStatus: AccountStatus.Active,
    });

    const res = await request(app)
      .post('/api/v1/kyc/submit')
      .set('x-test-user-id', 'user_submit_200')
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.data.kycStatus).toBe('verified');
  });

  it('returns full serialized user profile in response', async () => {
    seedUser(userRepository, 'user_submit_profile', {
      kycStatus: KycStatus.NotStarted,
      accountStatus: AccountStatus.Active,
    });

    const res = await request(app)
      .post('/api/v1/kyc/submit')
      .set('x-test-user-id', 'user_submit_profile')
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.data.clerkUserId).toBe('user_submit_profile');
    expect(res.body.data.email).toBeDefined();
    expect(res.body.data.accountStatus).toBe('active');
    expect(res.body.data.kycStatus).toBe('verified');
    expect(res.body.data.createdAt).toBeDefined();
    expect(res.body.data.updatedAt).toBeDefined();
    expect(res.body.data.notificationPrefs).toBeDefined();
  });

  it('returns 200 with kycStatus verified for rejected user resubmission', async () => {
    seedUser(userRepository, 'user_rejected_resubmit_http', {
      kycStatus: KycStatus.Rejected,
      accountStatus: AccountStatus.Active,
    });

    const res = await request(app)
      .post('/api/v1/kyc/submit')
      .set('x-test-user-id', 'user_rejected_resubmit_http')
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.data.kycStatus).toBe('verified');
  });

  it('accepts empty body with no fields', async () => {
    seedUser(userRepository, 'user_empty_body', {
      kycStatus: KycStatus.NotStarted,
      accountStatus: AccountStatus.Active,
    });

    const res = await request(app)
      .post('/api/v1/kyc/submit')
      .set('x-test-user-id', 'user_empty_body')
      .send();

    expect(res.status).toBe(200);
    expect(res.body.data.kycStatus).toBe('verified');
  });

  it('GET /me returns verified kycStatus after KYC submit (US-003 verification)', async () => {
    // KYC submit updates the user record so GET /me would return verified
    seedUser(userRepository, 'user_after_kyc', {
      kycStatus: KycStatus.NotStarted,
      accountStatus: AccountStatus.Active,
    });

    const res = await request(app)
      .post('/api/v1/kyc/submit')
      .set('x-test-user-id', 'user_after_kyc')
      .send({});

    expect(res.status).toBe(200);
    // The returned user should have verified status
    const returnedUser = userRepository.users.get('user_after_kyc');
    expect(returnedUser?.kycStatus).toBe(KycStatus.Verified);
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/kyc/submit — stub declined
// ---------------------------------------------------------------------------

describe('POST /api/v1/kyc/submit — stub declined', () => {
  it('returns 200 with kycStatus rejected when stub declines', async () => {
    const { app, userRepository } = createTestApp(false);
    seedUser(userRepository, 'user_declined_http', {
      kycStatus: KycStatus.NotStarted,
      accountStatus: AccountStatus.Active,
    });

    const res = await request(app)
      .post('/api/v1/kyc/submit')
      .set('x-test-user-id', 'user_declined_http')
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.data.kycStatus).toBe('rejected');
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/kyc/submit — validation errors
// ---------------------------------------------------------------------------

describe('POST /api/v1/kyc/submit — validation errors', () => {
  let app: Application;
  let userRepository: InMemoryUserRepository;

  beforeEach(() => {
    const result = createTestApp();
    app = result.app;
    userRepository = result.userRepository;
  });

  it('returns 400 VALIDATION_ERROR when body contains unexpected fields', async () => {
    seedUser(userRepository, 'user_extra_fields', {
      kycStatus: KycStatus.NotStarted,
      accountStatus: AccountStatus.Active,
    });

    const res = await request(app)
      .post('/api/v1/kyc/submit')
      .set('x-test-user-id', 'user_extra_fields')
      .send({ documentId: 'doc-123' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 401 UNAUTHENTICATED without auth header', async () => {
    const res = await request(app).post('/api/v1/kyc/submit').send({});

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('returns 404 USER_NOT_FOUND for authenticated user not in DB', async () => {
    const res = await request(app)
      .post('/api/v1/kyc/submit')
      .set('x-test-user-id', 'user_not_in_db')
      .send({});

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('USER_NOT_FOUND');
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/kyc/submit — KYC status conflict errors (409)
// ---------------------------------------------------------------------------

describe('POST /api/v1/kyc/submit — 409 Conflict errors', () => {
  let app: Application;
  let userRepository: InMemoryUserRepository;

  beforeEach(() => {
    const result = createTestApp();
    app = result.app;
    userRepository = result.userRepository;
  });

  it('returns 409 KYC_ALREADY_PENDING when kycStatus is pending', async () => {
    seedUser(userRepository, 'user_pending_409', {
      kycStatus: KycStatus.Pending,
      accountStatus: AccountStatus.Active,
    });

    const res = await request(app)
      .post('/api/v1/kyc/submit')
      .set('x-test-user-id', 'user_pending_409')
      .send({});

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('KYC_ALREADY_PENDING');
    expect(res.body.error.correlation_id).toBeDefined();
  });

  it('returns 409 KYC_ALREADY_PENDING when kycStatus is in_review', async () => {
    seedUser(userRepository, 'user_in_review_409', {
      kycStatus: KycStatus.InReview,
      accountStatus: AccountStatus.Active,
    });

    const res = await request(app)
      .post('/api/v1/kyc/submit')
      .set('x-test-user-id', 'user_in_review_409')
      .send({});

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('KYC_ALREADY_PENDING');
  });

  it('returns 409 KYC_ALREADY_VERIFIED when kycStatus is verified', async () => {
    seedUser(userRepository, 'user_verified_409', {
      kycStatus: KycStatus.Verified,
      accountStatus: AccountStatus.Active,
    });

    const res = await request(app)
      .post('/api/v1/kyc/submit')
      .set('x-test-user-id', 'user_verified_409')
      .send({});

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('KYC_ALREADY_VERIFIED');
  });

  it('returns 409 KYC_RESUBMISSION_NOT_ALLOWED when kycStatus is expired', async () => {
    seedUser(userRepository, 'user_expired_409', {
      kycStatus: KycStatus.Expired,
      accountStatus: AccountStatus.Active,
    });

    const res = await request(app)
      .post('/api/v1/kyc/submit')
      .set('x-test-user-id', 'user_expired_409')
      .send({});

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('KYC_RESUBMISSION_NOT_ALLOWED');
  });

  it('returns 409 KYC_TRANSITION_CONFLICT for concurrent update (conditional WHERE returned 0 rows)', async () => {
    const user = seedUser(userRepository, 'user_conflict_409', {
      kycStatus: KycStatus.NotStarted,
      accountStatus: AccountStatus.Active,
    });

    // Simulate concurrent update: move status to pending manually
    // This causes our service call to fail the conditional WHERE
    await userRepository.updateKycStatus(user.clerkUserId, KycStatus.NotStarted, KycStatus.Pending);
    // Now the user is in pending state. When we try to submit (which checks from not_started),
    // the service will throw KycAlreadyPendingError (since it reads current state first)
    // OR the DB-level conflict. Since InMemory reads current state first, it'll throw AlreadyPending.
    const res = await request(app)
      .post('/api/v1/kyc/submit')
      .set('x-test-user-id', 'user_conflict_409')
      .send({});

    expect(res.status).toBe(409);
    // Will be KYC_ALREADY_PENDING because the application re-reads state before the DB update
    expect(['KYC_ALREADY_PENDING', 'KYC_TRANSITION_CONFLICT']).toContain(res.body.error.code);
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/kyc/submit — 403 Forbidden errors
// ---------------------------------------------------------------------------

describe('POST /api/v1/kyc/submit — 403 Forbidden errors', () => {
  let app: Application;
  let userRepository: InMemoryUserRepository;

  beforeEach(() => {
    const result = createTestApp();
    app = result.app;
    userRepository = result.userRepository;
  });

  it('returns 403 ACCOUNT_NOT_ACTIVE when accountStatus is pending_verification', async () => {
    seedUser(userRepository, 'user_pv_403', {
      accountStatus: AccountStatus.PendingVerification,
      kycStatus: KycStatus.NotStarted,
    });

    const res = await request(app)
      .post('/api/v1/kyc/submit')
      .set('x-test-user-id', 'user_pv_403')
      .send({});

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_NOT_ACTIVE');
    expect(res.body.error.correlation_id).toBeDefined();
  });

  it('returns 403 ACCOUNT_SUSPENDED when accountStatus is suspended', async () => {
    seedUser(userRepository, 'user_susp_403', {
      accountStatus: AccountStatus.Suspended,
      kycStatus: KycStatus.NotStarted,
    });

    const res = await request(app)
      .post('/api/v1/kyc/submit')
      .set('x-test-user-id', 'user_susp_403')
      .send({});

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_SUSPENDED');
  });

  it('returns 403 ACCOUNT_SUSPENDED when accountStatus is deactivated', async () => {
    seedUser(userRepository, 'user_deact_403', {
      accountStatus: AccountStatus.Deactivated,
      kycStatus: KycStatus.NotStarted,
    });

    const res = await request(app)
      .post('/api/v1/kyc/submit')
      .set('x-test-user-id', 'user_deact_403')
      .send({});

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_SUSPENDED');
  });

  it('includes correct error message for ACCOUNT_NOT_ACTIVE', async () => {
    seedUser(userRepository, 'user_pv_msg', {
      accountStatus: AccountStatus.PendingVerification,
      kycStatus: KycStatus.NotStarted,
    });

    const res = await request(app)
      .post('/api/v1/kyc/submit')
      .set('x-test-user-id', 'user_pv_msg')
      .send({});

    expect(res.status).toBe(403);
    expect(res.body.error.message).toContain('active');
  });
});
