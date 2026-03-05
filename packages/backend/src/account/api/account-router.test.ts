import type { Application } from 'express';
import express from 'express';
import pino from 'pino';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { correlationIdMiddleware } from '../../shared/middleware/auth.js';
import { createErrorHandler } from '../../shared/middleware/error-handler.js';
import { InMemoryUserRepository } from '../adapters/in-memory-user-repository.adapter.js';
import { MockAuditLogger } from '../adapters/mock-audit-logger.adapter.js';
import { MockClerkAuthAdapter } from '../adapters/mock-clerk-auth.adapter.js';
import { AccountAppService } from '../application/account-app-service.js';
import { User } from '../domain/models/user.js';
import { AccountStatus } from '../domain/value-objects/account-status.js';
import { KycStatus } from '../domain/value-objects/kyc-status.js';
import { NotificationPreferences } from '../domain/value-objects/notification-preferences.js';
import { Role } from '../domain/value-objects/role.js';
import { createAccountRouter } from './account-router.js';

// Mock @clerk/express to avoid real Clerk JWT validation in tests
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

function seedUser(repo: InMemoryUserRepository, clerkUserId: string) {
  const user = User.reconstitute({
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
  });
  repo.users.set(clerkUserId, user);
  return user;
}

function createTestApp(): {
  app: Application;
  userRepository: InMemoryUserRepository;
  auditLogger: MockAuditLogger;
} {
  const userRepository = new InMemoryUserRepository();
  const clerkAuth = new MockClerkAuthAdapter();
  const auditLogger = new MockAuditLogger();
  const accountAppService = new AccountAppService(userRepository, clerkAuth, auditLogger, logger);

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

  // Routes with require-auth guard
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

  app.use('/api/v1', createAccountRouter(accountAppService));
  app.use(createErrorHandler(logger));

  return { app, userRepository, auditLogger };
}

describe('GET /health', () => {
  it('returns 200 without Authorization header', async () => {
    const app = express();
    app.get('/health', (_req, res) => {
      res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toBeDefined();
  });
});

describe('POST /api/v1/auth/sync', () => {
  let app: Application;
  let userRepository: InMemoryUserRepository;

  beforeEach(() => {
    const result = createTestApp();
    app = result.app;
    userRepository = result.userRepository;
  });

  it('creates user and returns 200 with user profile when authenticated', async () => {
    const res = await request(app)
      .post('/api/v1/auth/sync')
      .set('x-test-user-id', 'user_test_backer')
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.clerkUserId).toBe('user_test_backer');
  });

  it('is idempotent: second call returns 200 with updated lastSeenAt', async () => {
    // First call
    await request(app).post('/api/v1/auth/sync').set('x-test-user-id', 'user_test_backer').send({});

    // Second call
    const res = await request(app)
      .post('/api/v1/auth/sync')
      .set('x-test-user-id', 'user_test_backer')
      .send({});

    expect(res.status).toBe(200);
    expect(userRepository.users.has('user_test_backer')).toBe(true);
  });

  it('returns 401 UNAUTHENTICATED without auth header', async () => {
    const res = await request(app).post('/api/v1/auth/sync').send({});
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });
});

describe('GET /api/v1/me', () => {
  let app: Application;
  let userRepository: InMemoryUserRepository;

  beforeEach(() => {
    const result = createTestApp();
    app = result.app;
    userRepository = result.userRepository;
  });

  it('returns 200 with full user profile for authenticated user', async () => {
    seedUser(userRepository, 'user_test_backer');

    const res = await request(app).get('/api/v1/me').set('x-test-user-id', 'user_test_backer');

    expect(res.status).toBe(200);
    expect(res.body.data.clerkUserId).toBe('user_test_backer');
    expect(res.body.data.accountStatus).toBeDefined();
    expect(res.body.data.notificationPrefs).toBeDefined();
  });

  it('returns 404 USER_NOT_FOUND for authenticated user not in DB', async () => {
    const res = await request(app).get('/api/v1/me').set('x-test-user-id', 'user_not_in_db');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('USER_NOT_FOUND');
  });

  it('returns 401 UNAUTHENTICATED without auth header', async () => {
    const res = await request(app).get('/api/v1/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });
});

describe('PATCH /api/v1/me/profile', () => {
  let app: Application;
  let userRepository: InMemoryUserRepository;

  beforeEach(() => {
    const result = createTestApp();
    app = result.app;
    userRepository = result.userRepository;
  });

  it('returns 200 with updated profile for valid update', async () => {
    seedUser(userRepository, 'user_profile');

    const res = await request(app)
      .patch('/api/v1/me/profile')
      .set('x-test-user-id', 'user_profile')
      .send({ displayName: 'Ada Lovelace', bio: 'Mars pioneer' });

    expect(res.status).toBe(200);
    expect(res.body.data.displayName).toBe('Ada Lovelace');
    expect(res.body.data.bio).toBe('Mars pioneer');
  });

  it('stores empty string displayName as null', async () => {
    seedUser(userRepository, 'user_emptyname');

    const res = await request(app)
      .patch('/api/v1/me/profile')
      .set('x-test-user-id', 'user_emptyname')
      .send({ displayName: '' });

    expect(res.status).toBe(200);
    expect(res.body.data.displayName).toBeNull();
  });

  it('returns 400 VALIDATION_ERROR for displayName > 255 chars', async () => {
    seedUser(userRepository, 'user_longname');

    const res = await request(app)
      .patch('/api/v1/me/profile')
      .set('x-test-user-id', 'user_longname')
      .send({ displayName: 'a'.repeat(256) });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR for bio > 500 chars', async () => {
    seedUser(userRepository, 'user_longbio');

    const res = await request(app)
      .patch('/api/v1/me/profile')
      .set('x-test-user-id', 'user_longbio')
      .send({ bio: 'b'.repeat(501) });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR for invalid avatarUrl', async () => {
    seedUser(userRepository, 'user_badurl');

    const res = await request(app)
      .patch('/api/v1/me/profile')
      .set('x-test-user-id', 'user_badurl')
      .send({ avatarUrl: 'not-a-url' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR for unknown key in body', async () => {
    seedUser(userRepository, 'user_unknownkey');

    const res = await request(app)
      .patch('/api/v1/me/profile')
      .set('x-test-user-id', 'user_unknownkey')
      .send({ unknownField: 'value' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 401 for unauthenticated request', async () => {
    const res = await request(app).patch('/api/v1/me/profile').send({ displayName: 'Test' });
    expect(res.status).toBe(401);
  });

  it('returns 404 for update on non-existent user', async () => {
    const res = await request(app)
      .patch('/api/v1/me/profile')
      .set('x-test-user-id', 'user_noexist')
      .send({ displayName: 'Test' });
    expect(res.status).toBe(404);
  });
});

describe('GET /api/v1/me/notifications', () => {
  let app: Application;
  let userRepository: InMemoryUserRepository;

  beforeEach(() => {
    const result = createTestApp();
    app = result.app;
    userRepository = result.userRepository;
  });

  it('returns 200 with default preferences for new user', async () => {
    seedUser(userRepository, 'user_notif');

    const res = await request(app)
      .get('/api/v1/me/notifications')
      .set('x-test-user-id', 'user_notif');

    expect(res.status).toBe(200);
    expect(res.body.data.securityAlerts).toBe(true);
    expect(res.body.data.campaignUpdates).toBe(true);
    expect(res.body.data.platformAnnouncements).toBe(false);
  });

  it('returns 401 for unauthenticated request', async () => {
    const res = await request(app).get('/api/v1/me/notifications');
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/v1/me/notifications', () => {
  let app: Application;
  let userRepository: InMemoryUserRepository;

  beforeEach(() => {
    const result = createTestApp();
    app = result.app;
    userRepository = result.userRepository;
  });

  it('valid partial update persists correctly', async () => {
    seedUser(userRepository, 'user_patch_notif');

    const res = await request(app)
      .patch('/api/v1/me/notifications')
      .set('x-test-user-id', 'user_patch_notif')
      .send({ recommendations: false });

    expect(res.status).toBe(200);
    expect(res.body.data.recommendations).toBe(false);
    expect(res.body.data.securityAlerts).toBe(true); // Always true
  });

  it('returns 400 VALIDATION_ERROR if securityAlerts key is present', async () => {
    seedUser(userRepository, 'user_security');

    const res = await request(app)
      .patch('/api/v1/me/notifications')
      .set('x-test-user-id', 'user_security')
      .send({ securityAlerts: false });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR for unknown key', async () => {
    seedUser(userRepository, 'user_unknwn');

    const res = await request(app)
      .patch('/api/v1/me/notifications')
      .set('x-test-user-id', 'user_unknwn')
      .send({ unknownPref: true });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR for non-boolean value', async () => {
    seedUser(userRepository, 'user_nonbool');

    const res = await request(app)
      .patch('/api/v1/me/notifications')
      .set('x-test-user-id', 'user_nonbool')
      .send({ recommendations: 'yes' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 401 for unauthenticated request', async () => {
    const res = await request(app)
      .patch('/api/v1/me/notifications')
      .send({ recommendations: false });
    expect(res.status).toBe(401);
  });
});




























