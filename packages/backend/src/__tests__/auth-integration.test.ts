import type { Request } from 'express';
import express from 'express';
import pino from 'pino';
import pinoHttp from 'pino-http';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryAccountRepository } from '../account/adapters/mock/in-memory-account-repository.js';
import { AccountAppService } from '../account/application/account-app-service.js';
import { Account } from '../account/domain/account.js';
import {
  type AuthClaimsExtractor,
  createEnrichAuthContext,
} from '../shared/middleware/enrich-auth-context.js';
import {
  type AuthExtractor,
  createRequireAuthentication,
} from '../shared/middleware/require-authentication.js';

const testLogger = pino({ level: 'silent' });

// Helper: create a mock auth extractor that reads from req.auth
function createTestAuthExtractor(
  userId: string | null = 'user_test_001',
): AuthExtractor & AuthClaimsExtractor {
  return {
    getUserId(_req: Request): string | null {
      return userId;
    },
    getEmail(_req: Request): string {
      return 'test@marsmission.fund';
    },
    getDisplayName(_req: Request): string | null {
      return 'Test User';
    },
  };
}

describe('requireAuthentication middleware', () => {
  it('returns 401 when no auth token present', async () => {
    const app = express();
    app.use(pinoHttp({ logger: testLogger }));
    const requireAuth = createRequireAuthentication(createTestAuthExtractor(null));
    app.get('/test', requireAuth, (_req, res) => {
      res.status(200).json({ ok: true });
    });

    const response = await request(app).get('/test');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
    expect(response.body.error.message).toBe('Authentication required.');
  });

  it('passes through when valid auth present', async () => {
    const app = express();
    app.use(pinoHttp({ logger: testLogger }));
    const requireAuth = createRequireAuthentication(createTestAuthExtractor('user_test_001'));
    app.get('/test', requireAuth, (_req, res) => {
      res.status(200).json({ ok: true });
    });

    const response = await request(app).get('/test');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });
});

describe('enrichAuthContext middleware', () => {
  let accountRepo: InMemoryAccountRepository;
  let accountAppService: AccountAppService;

  beforeEach(() => {
    accountRepo = new InMemoryAccountRepository();
    accountAppService = new AccountAppService(accountRepo, testLogger);
  });

  it('creates account via JIT on first request', async () => {
    const app = express();
    app.use(pinoHttp({ logger: testLogger }));
    const extractor = createTestAuthExtractor('user_new_001');
    const enrichContext = createEnrichAuthContext(accountAppService, extractor);
    app.get('/test', enrichContext, (req, res) => {
      res.status(200).json({ authContext: req.authContext });
    });

    const response = await request(app).get('/test');

    expect(response.status).toBe(200);
    expect(response.body.authContext.clerkUserId).toBe('user_new_001');
    expect(response.body.authContext.email).toBe('test@marsmission.fund');
    expect(response.body.authContext.accountStatus).toBe('active');
    expect(response.body.authContext.roles).toEqual(['backer']);
    expect(response.body.authContext.onboardingCompleted).toBe(false);
  });

  it('returns existing account on subsequent requests', async () => {
    const existing = Account.create({
      clerkUserId: 'user_existing_001',
      email: 'existing@marsmission.fund',
      displayName: 'Existing User',
    });
    accountRepo.seed(existing);

    const app = express();
    app.use(pinoHttp({ logger: testLogger }));
    const extractor = createTestAuthExtractor('user_existing_001');
    const enrichContext = createEnrichAuthContext(accountAppService, extractor);
    app.get('/test', enrichContext, (req, res) => {
      res.status(200).json({ authContext: req.authContext });
    });

    const response = await request(app).get('/test');

    expect(response.status).toBe(200);
    expect(response.body.authContext.clerkUserId).toBe('user_existing_001');
    expect(response.body.authContext.userId).toBe(existing.id);
  });

  it('returns 403 for suspended account', async () => {
    const suspended = Account.reconstitute({
      id: 'suspended-id',
      clerkUserId: 'user_suspended_001',
      email: 'suspended@marsmission.fund',
      displayName: null,
      status: 'suspended',
      roles: ['backer'],
      onboardingCompleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    accountRepo.seed(suspended);

    const app = express();
    app.use(pinoHttp({ logger: testLogger }));
    const extractor = createTestAuthExtractor('user_suspended_001');
    const enrichContext = createEnrichAuthContext(accountAppService, extractor);
    app.get('/test', enrichContext, (_req, res) => {
      res.status(200).json({ ok: true });
    });

    const response = await request(app).get('/test');

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('ACCOUNT_SUSPENDED');
    expect(response.body.error.message).toBe(
      'Your account has been suspended. Please contact support.',
    );
  });

  it('returns 403 for deactivated account', async () => {
    const deactivated = Account.reconstitute({
      id: 'deactivated-id',
      clerkUserId: 'user_deactivated_001',
      email: 'deactivated@marsmission.fund',
      displayName: null,
      status: 'deactivated',
      roles: ['backer'],
      onboardingCompleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    accountRepo.seed(deactivated);

    const app = express();
    app.use(pinoHttp({ logger: testLogger }));
    const extractor = createTestAuthExtractor('user_deactivated_001');
    const enrichContext = createEnrichAuthContext(accountAppService, extractor);
    app.get('/test', enrichContext, (_req, res) => {
      res.status(200).json({ ok: true });
    });

    const response = await request(app).get('/test');

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('ACCOUNT_SUSPENDED');
  });

  it('returns 403 for deleted account', async () => {
    const deleted = Account.reconstitute({
      id: 'deleted-id',
      clerkUserId: 'user_deleted_001',
      email: 'deleted@marsmission.fund',
      displayName: null,
      status: 'deleted',
      roles: ['backer'],
      onboardingCompleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    accountRepo.seed(deleted);

    const app = express();
    app.use(pinoHttp({ logger: testLogger }));
    const extractor = createTestAuthExtractor('user_deleted_001');
    const enrichContext = createEnrichAuthContext(accountAppService, extractor);
    app.get('/test', enrichContext, (_req, res) => {
      res.status(200).json({ ok: true });
    });

    const response = await request(app).get('/test');

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('ACCOUNT_DELETED');
    expect(response.body.error.message).toBe('This account has been deleted.');
  });

  it('returns 401 when no user ID in extractor', async () => {
    const app = express();
    app.use(pinoHttp({ logger: testLogger }));
    const extractor = createTestAuthExtractor(null);
    const enrichContext = createEnrichAuthContext(accountAppService, extractor);
    app.get('/test', enrichContext, (_req, res) => {
      res.status(200).json({ ok: true });
    });

    const response = await request(app).get('/test');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });
});
