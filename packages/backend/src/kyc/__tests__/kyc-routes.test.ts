import type express from 'express';
import type { Request as ExpressRequest } from 'express';
import pino from 'pino';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryAccountRepository } from '../../account/adapters/mock/in-memory-account-repository.js';
import { MockAuthAdapter } from '../../account/adapters/mock/mock-auth-adapter.js';
import { MockWebhookVerificationAdapter } from '../../account/adapters/mock/mock-webhook-verification-adapter.js';
import { AccountAppService } from '../../account/application/account-app-service.js';
import {
  Account,
  DEFAULT_NOTIFICATION_PREFERENCES,
} from '../../account/domain/account.js';
import { type AppDependencies, createApp } from '../../app.js';
import { InMemoryEventStore } from '../../shared/adapters/mock/in-memory-event-store.js';
import type { AuthClaimsExtractor } from '../../shared/middleware/enrich-auth-context.js';
import type { AuthExtractor } from '../../shared/middleware/require-authentication.js';
import { InMemoryKycRepository } from '../adapters/mock/in-memory-kyc-repository.js';
import { MockKycAdapter } from '../adapters/mock/mock-kyc-adapter.js';
import { KycAppService } from '../application/kyc-app-service.js';
import { KycVerification } from '../domain/kyc-verification.js';

const testLogger = pino({ level: 'silent' });

interface MockAuth {
  userId?: string;
  sessionClaims?: {
    email?: string;
    firstName?: string;
    lastName?: string;
  };
}

function getAuthFromReq(req: ExpressRequest): MockAuth | undefined {
  return (req as unknown as Record<string, unknown>).auth as MockAuth | undefined;
}

function createMockExtractor(): AuthExtractor & AuthClaimsExtractor {
  return {
    getUserId(req: ExpressRequest): string | null {
      const auth = getAuthFromReq(req);
      return auth?.userId ?? null;
    },
    getEmail(req: ExpressRequest): string {
      const auth = getAuthFromReq(req);
      return auth?.sessionClaims?.email ?? 'test@example.com';
    },
    getDisplayName(req: ExpressRequest): string | null {
      const auth = getAuthFromReq(req);
      const first = auth?.sessionClaims?.firstName ?? '';
      const last = auth?.sessionClaims?.lastName ?? '';
      return [first, last].filter(Boolean).join(' ') || null;
    },
  };
}

function makeAccount(id: string, roles: string[] = ['backer'], clerkUserId?: string) {
  return Account.reconstitute({
    id,
    clerkUserId: clerkUserId ?? `user_clerk_${id}`,
    email: `${id}@example.com`,
    displayName: 'Test User',
    bio: null,
    avatarUrl: null,
    status: 'active',
    roles: roles as Account['roles'],
    onboardingCompleted: true,
    onboardingStep: 'completed',
    notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES,
    createdAt: new Date('2026-03-05T00:00:00Z'),
    updatedAt: new Date('2026-03-05T00:00:00Z'),
  });
}

function createTestDeps(
  accountRepo: InMemoryAccountRepository,
  kycRepo: InMemoryKycRepository,
  eventStore: InMemoryEventStore,
  autoApprove = true,
): AppDependencies {
  const extractor = createMockExtractor();
  const kycAdapter = new MockKycAdapter();
  return {
    authPort: new MockAuthAdapter(),
    webhookVerifier: new MockWebhookVerificationAdapter(),
    accountAppService: new AccountAppService(accountRepo, eventStore, testLogger),
    kycAppService: new KycAppService(
      kycRepo,
      accountRepo,
      kycAdapter,
      eventStore,
      testLogger,
      autoApprove,
    ),
    authExtractor: extractor,
    claimsExtractor: extractor,
  };
}

function createUnauthenticatedDeps(
  accountRepo: InMemoryAccountRepository,
  kycRepo: InMemoryKycRepository,
  eventStore: InMemoryEventStore,
): AppDependencies {
  const extractor = createMockExtractor();
  const kycAdapter = new MockKycAdapter();
  const noopAuthPort = {
    verifyToken: (_token: string) => Promise.resolve(null),
    getMiddleware:
      () =>
      (
        _req: ExpressRequest,
        _res: import('express').Response,
        next: import('express').NextFunction,
      ) => {
        next();
      },
  };
  return {
    authPort: noopAuthPort,
    webhookVerifier: new MockWebhookVerificationAdapter(),
    accountAppService: new AccountAppService(accountRepo, eventStore, testLogger),
    kycAppService: new KycAppService(
      kycRepo,
      accountRepo,
      kycAdapter,
      eventStore,
      testLogger,
      true,
    ),
    authExtractor: extractor,
    claimsExtractor: extractor,
  };
}

// ─── POST /api/v1/kyc/submit ─────────────────────────────────────────────────

describe('POST /api/v1/kyc/submit', () => {
  let accountRepo: InMemoryAccountRepository;
  let kycRepo: InMemoryKycRepository;
  let eventStore: InMemoryEventStore;
  let app: express.Express;

  beforeEach(() => {
    accountRepo = new InMemoryAccountRepository();
    kycRepo = new InMemoryKycRepository();
    eventStore = new InMemoryEventStore();
    app = createApp(createTestDeps(accountRepo, kycRepo, eventStore));
  });

  it('returns 401 without auth', async () => {
    const unauthApp = createApp(createUnauthenticatedDeps(accountRepo, kycRepo, eventStore));
    const response = await request(unauthApp)
      .post('/api/v1/kyc/submit')
      .send({ document_type: 'passport' });
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('submits verification and auto-approves (mock)', async () => {
    // Hit GET accounts/me first to create the account
    await request(app).get('/api/v1/accounts/me');

    const response = await request(app)
      .post('/api/v1/kyc/submit')
      .send({ document_type: 'passport' });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('verified');
    expect(response.body.data.documentType).toBe('passport');
  });

  it('returns 200 with pending status when auto-approve disabled', async () => {
    const noAutoApp = createApp(createTestDeps(accountRepo, kycRepo, eventStore, false));
    await request(noAutoApp).get('/api/v1/accounts/me');

    const response = await request(noAutoApp)
      .post('/api/v1/kyc/submit')
      .send({ document_type: 'national_id' });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('pending');
  });

  it('returns 400 for invalid document_type', async () => {
    const response = await request(app)
      .post('/api/v1/kyc/submit')
      .send({ document_type: 'invalid_type' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 for missing document_type', async () => {
    const response = await request(app)
      .post('/api/v1/kyc/submit')
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('accepts optional front_document_ref and back_document_ref', async () => {
    await request(app).get('/api/v1/accounts/me');

    const response = await request(app)
      .post('/api/v1/kyc/submit')
      .send({
        document_type: 'drivers_licence',
        front_document_ref: 'mock://docs/front-001',
        back_document_ref: 'mock://docs/back-001',
      });

    expect(response.status).toBe(200);
  });

  it('returns 409 if already verified', async () => {
    await request(app).get('/api/v1/accounts/me');
    // First submit
    await request(app).post('/api/v1/kyc/submit').send({ document_type: 'passport' });
    // Try to submit again (now verified)
    const response = await request(app)
      .post('/api/v1/kyc/submit')
      .send({ document_type: 'passport' });

    expect(response.status).toBe(409);
  });

  it('returns 403 if locked', async () => {
    await request(app).get('/api/v1/accounts/me');
    const accounts = accountRepo.getAll();
    const account = accounts[0];
    if (!account) throw new Error('No account found');

    const lockedVerification = KycVerification.reconstitute({
      id: 'kyc-locked-001',
      accountId: account.id,
      status: 'locked',
      documentType: 'passport',
      providerReference: null,
      frontDocumentRef: null,
      backDocumentRef: null,
      failureCount: 5,
      verifiedAt: null,
      expiresAt: null,
      submittedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    kycRepo.seed(lockedVerification);

    const response = await request(app)
      .post('/api/v1/kyc/submit')
      .send({ document_type: 'passport' });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('KYC_LOCKED');
  });
});

// ─── GET /api/v1/kyc/status ──────────────────────────────────────────────────

describe('GET /api/v1/kyc/status', () => {
  let accountRepo: InMemoryAccountRepository;
  let kycRepo: InMemoryKycRepository;
  let eventStore: InMemoryEventStore;
  let app: express.Express;

  beforeEach(() => {
    accountRepo = new InMemoryAccountRepository();
    kycRepo = new InMemoryKycRepository();
    eventStore = new InMemoryEventStore();
    app = createApp(createTestDeps(accountRepo, kycRepo, eventStore));
  });

  it('returns 401 without auth', async () => {
    const unauthApp = createApp(createUnauthenticatedDeps(accountRepo, kycRepo, eventStore));
    const response = await request(unauthApp).get('/api/v1/kyc/status');
    expect(response.status).toBe(401);
  });

  it('returns not_verified when no record exists', async () => {
    const response = await request(app).get('/api/v1/kyc/status');
    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('not_verified');
  });

  it('returns current status after submission', async () => {
    await request(app).get('/api/v1/accounts/me');
    await request(app).post('/api/v1/kyc/submit').send({ document_type: 'passport' });

    const response = await request(app).get('/api/v1/kyc/status');
    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('verified');
  });
});

// ─── POST /api/v1/kyc/admin/unlock/:accountId ────────────────────────────────

describe('POST /api/v1/kyc/admin/unlock/:accountId', () => {
  let accountRepo: InMemoryAccountRepository;
  let kycRepo: InMemoryKycRepository;
  let eventStore: InMemoryEventStore;
  let app: express.Express;
  let adminAccount: Account;
  let targetAccount: Account;

  beforeEach(() => {
    accountRepo = new InMemoryAccountRepository();
    kycRepo = new InMemoryKycRepository();
    eventStore = new InMemoryEventStore();

    // The mock auth middleware always sets clerkUserId = 'user_mock_001'
    // We seed an admin account with that clerkUserId so enrichAuthContext finds it
    adminAccount = makeAccount('admin-001', ['backer', 'administrator'], 'user_mock_001');
    targetAccount = makeAccount('target-001', ['backer'], 'user_clerk_target');
    accountRepo.seed(adminAccount);
    accountRepo.seed(targetAccount);

    const lockedVerification = KycVerification.reconstitute({
      id: 'kyc-locked-test',
      accountId: targetAccount.id,
      status: 'locked',
      documentType: 'passport',
      providerReference: null,
      frontDocumentRef: null,
      backDocumentRef: null,
      failureCount: 5,
      verifiedAt: null,
      expiresAt: null,
      submittedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    kycRepo.seed(lockedVerification);

    app = createApp(createTestDeps(accountRepo, kycRepo, eventStore));
  });

  it('returns 200 and unlocks for authenticated admin', async () => {
    const response = await request(app)
      .post(`/api/v1/kyc/admin/unlock/${targetAccount.id}`);
    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('pending_resubmission');
  });

  it('returns 401 without auth', async () => {
    const unauthApp = createApp(createUnauthenticatedDeps(accountRepo, kycRepo, eventStore));
    const response = await request(unauthApp)
      .post(`/api/v1/kyc/admin/unlock/${targetAccount.id}`);
    expect(response.status).toBe(401);
  });

  it('returns 403 for non-admin user', async () => {
    // Seed a regular (non-admin) account with the mock clerkUserId
    const regularUserRepo = new InMemoryAccountRepository();
    const regularUser = makeAccount('regular-001', ['backer'], 'user_mock_001');
    regularUserRepo.seed(regularUser);

    const kycRepo2 = new InMemoryKycRepository();
    const eventStore2 = new InMemoryEventStore();
    const regularApp = createApp(createTestDeps(regularUserRepo, kycRepo2, eventStore2));

    const response = await request(regularApp)
      .post(`/api/v1/kyc/admin/unlock/${targetAccount.id}`);

    expect(response.status).toBe(403);
  });

  it('returns 404 when admin user but target has no KYC record', async () => {
    // Seed admin with mock clerkUserId, no KYC record for the target
    const adminOnlyRepo = new InMemoryAccountRepository();
    const adminAcc = makeAccount('admin-004', ['backer', 'administrator'], 'user_mock_001');
    adminOnlyRepo.seed(adminAcc);

    const emptyKycRepo = new InMemoryKycRepository();
    const eventStore2 = new InMemoryEventStore();
    const adminApp2 = createApp(createTestDeps(adminOnlyRepo, emptyKycRepo, eventStore2));

    // Now unlock a non-existent target (admin passes role check but 404 on KYC)
    const response = await request(adminApp2)
      .post('/api/v1/kyc/admin/unlock/completely-nonexistent-target-id');

    expect(response.status).toBe(404);
  });
});
