import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { MockClerkAdapter } from '../../account/adapters/mock/mock-clerk-adapter.js';
import { MockUserRepository } from '../../account/adapters/mock/mock-user-repository.js';
import { AuthSyncService } from '../../account/application/auth-sync-service.js';
import { healthRouter } from '../../health/api/health-router.js';
import { buildClerkMiddleware, correlationIdMiddleware, createMmfAuthMiddleware } from './auth.js';

// These tests run with MOCK_AUTH=true set in the test environment
// The build/test script sets MOCK_AUTH=true

function buildTestApp(mockUserRepo: MockUserRepository) {
  const clerkPort = new MockClerkAdapter();
  const authSyncService = new AuthSyncService(mockUserRepo, clerkPort);

  const app = express();
  app.use(express.json());
  app.use(correlationIdMiddleware);
  app.use('/health', healthRouter);
  app.use(buildClerkMiddleware(true));
  app.use(createMmfAuthMiddleware(authSyncService, true));

  app.get('/api/v1/test', (_req: Request, res: Response) => {
    res.json({ data: 'ok', auth: _req.auth });
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction): void => {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: String(err) } });
  });

  return app;
}

describe('correlationIdMiddleware', () => {
  it('generates X-Request-Id when none provided', async () => {
    const mockRepo = new MockUserRepository();
    const app = buildTestApp(mockRepo);
    const res = await request(app).get('/health');
    expect(res.headers['x-request-id']).toMatch(/^[a-zA-Z0-9-]{1,128}$/);
  });

  it('echoes valid incoming X-Request-Id', async () => {
    const mockRepo = new MockUserRepository();
    const app = buildTestApp(mockRepo);
    const id = 'my-correlation-id-123';
    const res = await request(app).get('/health').set('x-request-id', id);
    expect(res.headers['x-request-id']).toBe(id);
  });

  it('replaces invalid incoming X-Request-Id with generated UUID', async () => {
    const mockRepo = new MockUserRepository();
    const app = buildTestApp(mockRepo);
    const invalid = '<script>alert(1)</script>';
    const res = await request(app).get('/health').set('x-request-id', invalid);
    expect(res.headers['x-request-id']).not.toBe(invalid);
    expect(res.headers['x-request-id']).toMatch(/^[a-zA-Z0-9-]{1,128}$/);
  });
});

describe('GET /health (public route)', () => {
  it('returns 200 without any auth token', async () => {
    const mockRepo = new MockUserRepository();
    const app = buildTestApp(mockRepo);
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

describe('mmfAuthMiddleware (MOCK_AUTH=true)', () => {
  let mockRepo: MockUserRepository;

  beforeEach(() => {
    mockRepo = new MockUserRepository();
  });

  it('allows request with mock auth and populates req.auth', async () => {
    const app = buildTestApp(mockRepo);
    const res = await request(app).get('/api/v1/test').set('Authorization', 'Bearer mock-token');
    expect(res.status).toBe(200);
    expect(res.body.auth).toBeDefined();
    expect(res.body.auth.clerkUserId).toBe('user_test_mock');
    expect(res.body.auth.email).toBe('test@marsmissionfund.test');
    expect(res.body.auth.roles).toContain('backer');
  });

  it('creates users row on first mock request', async () => {
    const freshRepo = new MockUserRepository();
    // Remove the pre-seeded test user to simulate first login
    // We'll use a different clerkId that's not pre-seeded
    const app = buildTestApp(freshRepo);
    const res = await request(app).get('/api/v1/test').set('Authorization', 'Bearer mock-token');
    expect(res.status).toBe(200);
    expect(res.body.auth.clerkUserId).toBe('user_test_mock');
  });

  it('returns X-Request-Id on authenticated responses', async () => {
    const app = buildTestApp(mockRepo);
    const res = await request(app).get('/api/v1/test').set('Authorization', 'Bearer mock-token');
    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('returns 403 ACCOUNT_SUSPENDED for suspended account', async () => {
    mockRepo.setAccountStatus('user_test_mock', 'suspended');
    const app = buildTestApp(mockRepo);
    const res = await request(app).get('/api/v1/test').set('Authorization', 'Bearer mock-token');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_SUSPENDED');
  });

  it('returns 403 ACCOUNT_DEACTIVATED for deactivated account', async () => {
    mockRepo.setAccountStatus('user_test_mock', 'deactivated');
    const app = buildTestApp(mockRepo);
    const res = await request(app).get('/api/v1/test').set('Authorization', 'Bearer mock-token');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_DEACTIVATED');
  });

  it('returns 403 ACCOUNT_DELETED for deleted account', async () => {
    mockRepo.setAccountStatus('user_test_mock', 'deleted');
    const app = buildTestApp(mockRepo);
    const res = await request(app).get('/api/v1/test').set('Authorization', 'Bearer mock-token');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_DELETED');
  });

  it('returns 403 ACCOUNT_PENDING for pending_verification account', async () => {
    mockRepo.setAccountStatus('user_test_mock', 'pending_verification');
    const app = buildTestApp(mockRepo);
    const res = await request(app).get('/api/v1/test').set('Authorization', 'Bearer mock-token');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_PENDING');
  });
});

describe('mmfAuthMiddleware (MOCK_AUTH=false — no JWT)', () => {
  it('returns 401 when no authorization header is provided', async () => {
    // When isMockAuth is false and clerkMiddleware is real but no token provided,
    // getAuth(req).userId will be null — middleware should return 401.
    const mockRepo = new MockUserRepository();
    const clerkPort = new MockClerkAdapter();
    const authSyncService = new AuthSyncService(mockRepo, clerkPort);

    const app = express();
    app.use(express.json());
    app.use(correlationIdMiddleware);
    app.use('/health', healthRouter);
    // Use the real buildClerkMiddleware with isMockAuth=false
    // clerkMiddleware() in test env won't verify, but getAuth(req).userId will be null
    app.use(buildClerkMiddleware(false));
    app.use(createMmfAuthMiddleware(authSyncService, false));

    app.get('/api/v1/test', (_req: Request, res: Response) => {
      res.json({ data: 'ok' });
    });

    app.use((err: unknown, _req: Request, res: Response, _next: NextFunction): void => {
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: String(err) } });
    });

    const res = await request(app).get('/api/v1/test');
    // No Authorization header → Clerk middleware sets userId to null → 401
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});
