import express, { type NextFunction, type Request, type Response } from 'express';
import pino from 'pino';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { healthRouter } from '../../health/api/health-router.js';
import { MockKycAdapter } from '../../kyc/adapters/mock/mock-kyc-adapter.js';
import { KycService } from '../../kyc/application/kyc-service.js';
import {
  buildClerkMiddleware,
  correlationIdMiddleware,
  createMmfAuthMiddleware,
} from '../../shared/middleware/auth.js';
import { MockClerkAdapter } from '../adapters/mock/mock-clerk-adapter.js';
import { MockUserRepository } from '../adapters/mock/mock-user-repository.js';
import { AuthSyncService } from '../application/auth-sync-service.js';
import { ProfileService } from '../application/profile-service.js';
import { createApiRouter } from './api-router.js';

const silentLogger = pino({ level: 'silent' });

function buildTestApp(mockUserRepo: MockUserRepository) {
  const clerkPort = new MockClerkAdapter();
  const authSyncService = new AuthSyncService(mockUserRepo, clerkPort);
  const profileService = new ProfileService(mockUserRepo);
  const kycService = new KycService(new MockKycAdapter(), silentLogger);

  const app = express();
  app.use(express.json());
  app.use(correlationIdMiddleware);
  app.use('/health', healthRouter);
  app.use(buildClerkMiddleware(true));
  app.use(createMmfAuthMiddleware(authSyncService, true));
  app.use('/api/v1', createApiRouter(mockUserRepo, profileService, kycService));

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction): void => {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: String(err) } });
  });

  return app;
}

describe('GET /api/v1/me', () => {
  let mockRepo: MockUserRepository;

  beforeEach(() => {
    mockRepo = new MockUserRepository();
  });

  it('returns 200 with full user profile and roles', async () => {
    const app = buildTestApp(mockRepo);
    const res = await request(app).get('/api/v1/me').set('Authorization', 'Bearer mock-token');
    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.clerkUserId).toBe('user_test_mock');
    expect(res.body.data.email).toBe('test@marsmissionfund.test');
    expect(res.body.data.displayName).toBeNull();
    expect(res.body.data.avatarUrl).toBeNull();
    expect(res.body.data.accountStatus).toBe('active');
    expect(res.body.data.onboardingCompleted).toBe(false);
    expect(Array.isArray(res.body.data.roles)).toBe(true);
    expect(res.body.data.roles).toContain('backer');
    expect(res.body.data.createdAt).toBeDefined();
    expect(res.body.data.updatedAt).toBeDefined();
  });

  it('returns bio, onboardingStep, notificationPreferences with security_alerts: true', async () => {
    const app = buildTestApp(mockRepo);
    const res = await request(app).get('/api/v1/me').set('Authorization', 'Bearer mock-token');
    expect(res.status).toBe(200);
    expect(res.body.data.bio).toBeNull();
    expect(res.body.data.onboardingStep).toBeNull();
    expect(res.body.data.notificationPreferences).toBeDefined();
    expect(res.body.data.notificationPreferences.security_alerts).toBe(true);
    expect(res.body.data.notificationPreferences.campaign_updates).toBe(true);
    expect(res.body.data.notificationPreferences.platform_announcements).toBe(false);
  });

  it('first call triggers lazy sync and returns newly created user', async () => {
    const freshRepo = new MockUserRepository();
    const app = buildTestApp(freshRepo);

    const res = await request(app).get('/api/v1/me').set('Authorization', 'Bearer mock-token');
    expect(res.status).toBe(200);
    expect(res.body.data.clerkUserId).toBe('user_test_mock');
    expect(res.body.data.roles).toContain('backer');
  });

  it('returns 404 USER_NOT_FOUND when user deleted between middleware and handler', async () => {
    const appWithBrokenRepo = express();
    appWithBrokenRepo.use(express.json());
    appWithBrokenRepo.use(correlationIdMiddleware);

    const clerkPort = new MockClerkAdapter();
    const authSyncService = new AuthSyncService(mockRepo, clerkPort);
    appWithBrokenRepo.use(buildClerkMiddleware(true));
    appWithBrokenRepo.use(createMmfAuthMiddleware(authSyncService, true));

    const brokenRepo = new MockUserRepository();
    const originalFindById = brokenRepo.findById.bind(brokenRepo);
    brokenRepo.findById = async () => null;

    const profileService = new ProfileService(brokenRepo);
    const kycService2 = new KycService(new MockKycAdapter(), silentLogger);
    appWithBrokenRepo.use('/api/v1', createApiRouter(brokenRepo, profileService, kycService2));
    appWithBrokenRepo.use(
      (err: unknown, _req: Request, res: Response, _next: NextFunction): void => {
        res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: String(err) } });
      },
    );

    const res = await request(appWithBrokenRepo)
      .get('/api/v1/me')
      .set('Authorization', 'Bearer mock-token');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('USER_NOT_FOUND');

    void originalFindById;
  });
});

describe('PUT /api/v1/me', () => {
  let mockRepo: MockUserRepository;

  beforeEach(() => {
    mockRepo = new MockUserRepository();
  });

  it('returns 200 with updated display_name and bio', async () => {
    const app = buildTestApp(mockRepo);
    const res = await request(app)
      .put('/api/v1/me')
      .set('Authorization', 'Bearer mock-token')
      .send({ display_name: 'Yuki Tanaka', bio: 'Aerospace engineer.' });

    expect(res.status).toBe(200);
    expect(res.body.data.displayName).toBe('Yuki Tanaka');
    expect(res.body.data.bio).toBe('Aerospace engineer.');
  });

  it('returns 400 VALIDATION_ERROR for whitespace-only display_name', async () => {
    const app = buildTestApp(mockRepo);
    const res = await request(app)
      .put('/api/v1/me')
      .set('Authorization', 'Bearer mock-token')
      .send({ display_name: '   ' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR for bio exceeding 500 chars', async () => {
    const app = buildTestApp(mockRepo);
    const longBio = 'x'.repeat(501);
    const res = await request(app)
      .put('/api/v1/me')
      .set('Authorization', 'Bearer mock-token')
      .send({ bio: longBio });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 200 with displayName: null when display_name: null is sent', async () => {
    const app = buildTestApp(mockRepo);
    const res = await request(app)
      .put('/api/v1/me')
      .set('Authorization', 'Bearer mock-token')
      .send({ display_name: null });

    expect(res.status).toBe(200);
    expect(res.body.data.displayName).toBeNull();
  });

  it('returns 401 without auth header', async () => {
    const app = buildTestApp(mockRepo);
    const res = await request(app).put('/api/v1/me').send({ display_name: 'Test' });

    expect(res.status).toBe(401);
  });
});

describe('PUT /api/v1/me/notification-preferences', () => {
  let mockRepo: MockUserRepository;

  beforeEach(() => {
    mockRepo = new MockUserRepository();
  });

  const validPrefs = {
    campaign_updates: false,
    milestone_completions: true,
    contribution_confirmations: true,
    new_recommendations: false,
    platform_announcements: true,
  };

  it('returns 200 with updated prefs and security_alerts: true', async () => {
    const app = buildTestApp(mockRepo);
    const res = await request(app)
      .put('/api/v1/me/notification-preferences')
      .set('Authorization', 'Bearer mock-token')
      .send(validPrefs);

    expect(res.status).toBe(200);
    expect(res.body.data.notificationPreferences.campaign_updates).toBe(false);
    expect(res.body.data.notificationPreferences.platform_announcements).toBe(true);
    expect(res.body.data.notificationPreferences.security_alerts).toBe(true);
  });

  it('returns 400 when a required field is missing', async () => {
    const app = buildTestApp(mockRepo);
    const { campaign_updates: _removed, ...missingOne } = validPrefs;
    const res = await request(app)
      .put('/api/v1/me/notification-preferences')
      .set('Authorization', 'Bearer mock-token')
      .send(missingOne);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when security_alerts is included (unknown key)', async () => {
    const app = buildTestApp(mockRepo);
    const res = await request(app)
      .put('/api/v1/me/notification-preferences')
      .set('Authorization', 'Bearer mock-token')
      .send({ ...validPrefs, security_alerts: false });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when an unknown key is included', async () => {
    const app = buildTestApp(mockRepo);
    const res = await request(app)
      .put('/api/v1/me/notification-preferences')
      .set('Authorization', 'Bearer mock-token')
      .send({ ...validPrefs, unknown_key: true });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /api/v1/me/onboarding/complete', () => {
  let mockRepo: MockUserRepository;

  beforeEach(() => {
    mockRepo = new MockUserRepository();
  });

  it('returns 200 with onboardingCompleted: true and roles in response', async () => {
    const app = buildTestApp(mockRepo);
    const res = await request(app)
      .post('/api/v1/me/onboarding/complete')
      .set('Authorization', 'Bearer mock-token')
      .send({ step: 3, roles: ['backer', 'creator'] });

    expect(res.status).toBe(200);
    expect(res.body.data.onboardingCompleted).toBe(true);
    expect(res.body.data.roles).toContain('backer');
    expect(res.body.data.roles).toContain('creator');
    expect(res.body.data.onboardingStep).toBe(3);
  });

  it('returns 400 when roles array is empty', async () => {
    const app = buildTestApp(mockRepo);
    const res = await request(app)
      .post('/api/v1/me/onboarding/complete')
      .set('Authorization', 'Bearer mock-token')
      .send({ step: 3, roles: [] });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('is idempotent on second call — returns 200 without error', async () => {
    const app = buildTestApp(mockRepo);
    await request(app)
      .post('/api/v1/me/onboarding/complete')
      .set('Authorization', 'Bearer mock-token')
      .send({ step: 3, roles: ['backer'] });

    const res2 = await request(app)
      .post('/api/v1/me/onboarding/complete')
      .set('Authorization', 'Bearer mock-token')
      .send({ step: 3, roles: ['backer'] });

    expect(res2.status).toBe(200);
    expect(res2.body.data.onboardingCompleted).toBe(true);
  });
});

describe('PATCH /api/v1/me/onboarding/step', () => {
  let mockRepo: MockUserRepository;

  beforeEach(() => {
    mockRepo = new MockUserRepository();
  });

  it('returns 204 with step 2', async () => {
    const app = buildTestApp(mockRepo);
    const res = await request(app)
      .patch('/api/v1/me/onboarding/step')
      .set('Authorization', 'Bearer mock-token')
      .send({ step: 2 });

    expect(res.status).toBe(204);
  });

  it('returns 400 with step 0', async () => {
    const app = buildTestApp(mockRepo);
    const res = await request(app)
      .patch('/api/v1/me/onboarding/step')
      .set('Authorization', 'Bearer mock-token')
      .send({ step: 0 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 with step 4', async () => {
    const app = buildTestApp(mockRepo);
    const res = await request(app)
      .patch('/api/v1/me/onboarding/step')
      .set('Authorization', 'Bearer mock-token')
      .send({ step: 4 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
