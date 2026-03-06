import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { healthRouter } from '../../health/api/health-router.js';
import {
  buildClerkMiddleware,
  correlationIdMiddleware,
  createMmfAuthMiddleware,
} from '../../shared/middleware/auth.js';
import { MockClerkAdapter } from '../adapters/mock/mock-clerk-adapter.js';
import { MockUserRepository } from '../adapters/mock/mock-user-repository.js';
import { AuthSyncService } from '../application/auth-sync-service.js';
import { createApiRouter } from './api-router.js';

function buildTestApp(mockUserRepo: MockUserRepository) {
  const clerkPort = new MockClerkAdapter();
  const authSyncService = new AuthSyncService(mockUserRepo, clerkPort);

  const app = express();
  app.use(express.json());
  app.use(correlationIdMiddleware);
  app.use('/health', healthRouter);
  app.use(buildClerkMiddleware());
  app.use(createMmfAuthMiddleware(authSyncService));
  app.use('/api/v1', createApiRouter(mockUserRepo));

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction): void => {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: String(err) } });
  });

  return app;
}

describe('GET /api/v1/me', () => {
  let mockRepo: MockUserRepository;

  beforeEach(() => {
    mockRepo = new MockUserRepository();
    // Ensure MOCK_AUTH is set
    process.env.MOCK_AUTH = 'true';
  });

  it('returns 200 with full user profile and roles', async () => {
    const app = buildTestApp(mockRepo);
    const res = await request(app).get('/api/v1/me');
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

  it('first call triggers lazy sync and returns newly created user', async () => {
    // Create a repo without the pre-seeded user by calling upsertWithBackerRole for a new user
    const freshRepo = new MockUserRepository();
    const app = buildTestApp(freshRepo);

    const res = await request(app).get('/api/v1/me');
    expect(res.status).toBe(200);
    expect(res.body.data.clerkUserId).toBe('user_test_mock');
    expect(res.body.data.roles).toContain('backer');
  });

  it('returns 404 USER_NOT_FOUND when user deleted between middleware and handler', async () => {
    // We need to simulate findById returning null after auth passes
    // Manually override findById after middleware populates req.auth
    const appWithBrokenRepo = express();
    appWithBrokenRepo.use(express.json());
    appWithBrokenRepo.use(correlationIdMiddleware);

    // Auth middleware passes (user exists), but me endpoint's findById returns null
    const clerkPort = new MockClerkAdapter();
    const authSyncService = new AuthSyncService(mockRepo, clerkPort);
    appWithBrokenRepo.use(buildClerkMiddleware());
    appWithBrokenRepo.use(createMmfAuthMiddleware(authSyncService));

    // Create a repo where findById returns null
    const brokenRepo = new MockUserRepository();
    const originalFindById = brokenRepo.findById.bind(brokenRepo);
    brokenRepo.findById = async () => null;

    appWithBrokenRepo.use('/api/v1', createApiRouter(brokenRepo));
    appWithBrokenRepo.use(
      (err: unknown, _req: Request, res: Response, _next: NextFunction): void => {
        res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: String(err) } });
      },
    );

    const res = await request(appWithBrokenRepo).get('/api/v1/me');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('USER_NOT_FOUND');

    // Silence unused variable warning
    void originalFindById;
  });
});
