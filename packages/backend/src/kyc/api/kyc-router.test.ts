import express, { type NextFunction, type Request, type Response } from 'express';
import pino from 'pino';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { MockClerkAdapter } from '../../account/adapters/mock/mock-clerk-adapter.js';
import { MockUserRepository } from '../../account/adapters/mock/mock-user-repository.js';
import { createApiRouter } from '../../account/api/api-router.js';
import { AuthSyncService } from '../../account/application/auth-sync-service.js';
import { ProfileService } from '../../account/application/profile-service.js';
import {
  buildClerkMiddleware,
  correlationIdMiddleware,
  createMmfAuthMiddleware,
} from '../../shared/middleware/auth.js';
import { MockKycAdapter } from '../adapters/mock/mock-kyc-adapter.js';
import { KycService } from '../application/kyc-service.js';
import { KycRequiredError } from '../domain/errors.js';

const pinoLogger = pino({ level: 'silent' });

function buildTestApp(mockUserRepo: MockUserRepository, mockKycAdapter: MockKycAdapter) {
  const clerkPort = new MockClerkAdapter();
  const authSyncService = new AuthSyncService(mockUserRepo, clerkPort);
  const profileService = new ProfileService(mockUserRepo);
  const kycService = new KycService(mockKycAdapter, pinoLogger);

  const app = express();
  app.use(express.json());
  app.use(correlationIdMiddleware);
  app.use(buildClerkMiddleware(true));
  app.use(createMmfAuthMiddleware(authSyncService, true));
  app.use('/api/v1', createApiRouter(mockUserRepo, profileService, kycService));

  // Test-only route for requireVerified() gating tests
  app.get('/api/v1/test/creator-only', async (req, res, next) => {
    try {
      await kycService.requireVerified(req.auth!.userId);
      res.status(200).json({ ok: true });
    } catch (err) {
      if (err instanceof KycRequiredError) {
        res.status(403).json({ error: { code: 'KYC_REQUIRED', message: err.message } });
        return;
      }
      next(err);
    }
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction): void => {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: String(err) } });
  });

  return app;
}

describe('GET /api/v1/kyc/status', () => {
  let mockRepo: MockUserRepository;
  let mockKyc: MockKycAdapter;

  beforeEach(() => {
    mockRepo = new MockUserRepository();
    mockKyc = new MockKycAdapter();
  });

  it('returns 200 { data: { status: "not_verified", verifiedAt: null } } when no KYC row exists', async () => {
    const app = buildTestApp(mockRepo, mockKyc);
    const res = await request(app)
      .get('/api/v1/kyc/status')
      .set('Authorization', 'Bearer mock-token');

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('not_verified');
    expect(res.body.data.verifiedAt).toBeNull();
  });

  it('returns 200 { data: { status: "verified", verifiedAt: <ISO string> } } after mock.setStatus("verified")', async () => {
    const app = buildTestApp(mockRepo, mockKyc);

    // Get the user's actual ID from the me endpoint
    const meRes = await request(app).get('/api/v1/me').set('Authorization', 'Bearer mock-token');
    expect(meRes.status).toBe(200);
    const actualUserId: string = meRes.body.data.id as string;

    mockKyc.setStatus(actualUserId, 'verified', new Date('2026-03-06T12:34:56.000Z'));

    const res = await request(app)
      .get('/api/v1/kyc/status')
      .set('Authorization', 'Bearer mock-token');

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('verified');
    expect(res.body.data.verifiedAt).not.toBeNull();
    expect(typeof res.body.data.verifiedAt).toBe('string');
  });

  it('returns 200 { data: { status: "pending", verifiedAt: null } } after mock.setStatus("pending")', async () => {
    const app = buildTestApp(mockRepo, mockKyc);

    const meRes = await request(app).get('/api/v1/me').set('Authorization', 'Bearer mock-token');
    expect(meRes.status).toBe(200);
    const actualUserId: string = meRes.body.data.id as string;

    mockKyc.setStatus(actualUserId, 'pending', null);

    const res = await request(app)
      .get('/api/v1/kyc/status')
      .set('Authorization', 'Bearer mock-token');

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('pending');
    expect(res.body.data.verifiedAt).toBeNull();
  });

  it('returns 401 without Authorization header', async () => {
    const app = buildTestApp(mockRepo, mockKyc);
    const res = await request(app).get('/api/v1/kyc/status');

    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/kyc/submit', () => {
  let mockRepo: MockUserRepository;
  let mockKyc: MockKycAdapter;

  beforeEach(() => {
    mockRepo = new MockUserRepository();
    mockKyc = new MockKycAdapter();
  });

  it('returns 201 with { data: { status: "verified", verifiedAt: <not null> } } for valid submission', async () => {
    const app = buildTestApp(mockRepo, mockKyc);
    const res = await request(app)
      .post('/api/v1/kyc/submit')
      .set('Authorization', 'Bearer mock-token')
      .send({ documentType: 'passport' });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('verified');
    expect(res.body.data.verifiedAt).not.toBeNull();
  });

  it('status: "verified" is confirmed by subsequent GET /api/v1/kyc/status call', async () => {
    const app = buildTestApp(mockRepo, mockKyc);

    const submitRes = await request(app)
      .post('/api/v1/kyc/submit')
      .set('Authorization', 'Bearer mock-token')
      .send({ documentType: 'passport' });
    expect(submitRes.status).toBe(201);

    const statusRes = await request(app)
      .get('/api/v1/kyc/status')
      .set('Authorization', 'Bearer mock-token');
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.data.status).toBe('verified');
  });

  it('returns 400 VALIDATION_ERROR for invalid documentType value (e.g. "drivers_license")', async () => {
    const app = buildTestApp(mockRepo, mockKyc);
    const res = await request(app)
      .post('/api/v1/kyc/submit')
      .set('Authorization', 'Bearer mock-token')
      .send({ documentType: 'drivers_license' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR for unknown fields (e.g. { documentType: "passport", extra: true })', async () => {
    const app = buildTestApp(mockRepo, mockKyc);
    const res = await request(app)
      .post('/api/v1/kyc/submit')
      .set('Authorization', 'Bearer mock-token')
      .send({ documentType: 'passport', extra: true });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 409 ALREADY_VERIFIED when mock adapter has status "verified"', async () => {
    const app = buildTestApp(mockRepo, mockKyc);

    const meRes = await request(app).get('/api/v1/me').set('Authorization', 'Bearer mock-token');
    expect(meRes.status).toBe(200);
    const actualUserId: string = meRes.body.data.id as string;

    mockKyc.setStatus(actualUserId, 'verified', new Date());

    const res = await request(app)
      .post('/api/v1/kyc/submit')
      .set('Authorization', 'Bearer mock-token')
      .send({ documentType: 'passport' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ALREADY_VERIFIED');
  });

  it('returns 401 without Authorization header', async () => {
    const app = buildTestApp(mockRepo, mockKyc);
    const res = await request(app).post('/api/v1/kyc/submit').send({ documentType: 'passport' });

    expect(res.status).toBe(401);
  });
});

describe('KYC gating — requireVerified()', () => {
  let mockRepo: MockUserRepository;
  let mockKyc: MockKycAdapter;

  beforeEach(() => {
    mockRepo = new MockUserRepository();
    mockKyc = new MockKycAdapter();
  });

  it('returns 403 KYC_REQUIRED when user has not_verified status', async () => {
    const app = buildTestApp(mockRepo, mockKyc);
    const res = await request(app)
      .get('/api/v1/test/creator-only')
      .set('Authorization', 'Bearer mock-token');

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('KYC_REQUIRED');
  });

  it('returns 200 when user has verified status', async () => {
    const app = buildTestApp(mockRepo, mockKyc);

    const meRes = await request(app).get('/api/v1/me').set('Authorization', 'Bearer mock-token');
    expect(meRes.status).toBe(200);
    const actualUserId: string = meRes.body.data.id as string;

    mockKyc.setStatus(actualUserId, 'verified', new Date());

    const res = await request(app)
      .get('/api/v1/test/creator-only')
      .set('Authorization', 'Bearer mock-token');

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
