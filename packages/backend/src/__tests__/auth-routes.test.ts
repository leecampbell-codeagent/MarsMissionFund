import type express from 'express';
import type { Request as ExpressRequest } from 'express';
import pino from 'pino';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryAccountRepository } from '../account/adapters/mock/in-memory-account-repository.js';
import { MockAuthAdapter } from '../account/adapters/mock/mock-auth-adapter.js';
import { MockWebhookVerificationAdapter } from '../account/adapters/mock/mock-webhook-verification-adapter.js';
import { AccountAppService } from '../account/application/account-app-service.js';
import { Account } from '../account/domain/account.js';
import { type AppDependencies, createApp } from '../app.js';
import type { AuthClaimsExtractor } from '../shared/middleware/enrich-auth-context.js';
import type { AuthExtractor } from '../shared/middleware/require-authentication.js';

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
      return auth?.sessionClaims?.email ?? 'unknown@example.com';
    },
    getDisplayName(req: ExpressRequest): string | null {
      const auth = getAuthFromReq(req);
      const first = auth?.sessionClaims?.firstName ?? '';
      const last = auth?.sessionClaims?.lastName ?? '';
      const name = [first, last].filter(Boolean).join(' ');
      return name || null;
    },
  };
}

function createTestDeps(accountRepo: InMemoryAccountRepository): AppDependencies {
  const extractor = createMockExtractor();
  return {
    authPort: new MockAuthAdapter(),
    webhookVerifier: new MockWebhookVerificationAdapter(),
    accountAppService: new AccountAppService(accountRepo, testLogger),
    authExtractor: extractor,
    claimsExtractor: extractor,
  };
}

describe('GET /health', () => {
  it('returns 200 without auth token', async () => {
    const accountRepo = new InMemoryAccountRepository();
    const app = createApp(createTestDeps(accountRepo));

    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });
});

describe('GET /api/v1/auth/me', () => {
  let accountRepo: InMemoryAccountRepository;
  let app: express.Express;

  beforeEach(() => {
    accountRepo = new InMemoryAccountRepository();
    app = createApp(createTestDeps(accountRepo));
  });

  it('returns 200 with account data for authenticated user', async () => {
    const response = await request(app).get('/api/v1/auth/me');

    expect(response.status).toBe(200);
    expect(response.body.data).toBeDefined();
    expect(response.body.data.email).toBe('mock@example.com');
    expect(response.body.data.status).toBe('active');
    expect(response.body.data.roles).toEqual(['backer']);
    expect(response.body.data.onboarding_completed).toBe(false);
  });

  it('returns account data with JIT-created account', async () => {
    // First request creates the account via JIT
    const response1 = await request(app).get('/api/v1/auth/me');
    expect(response1.status).toBe(200);
    const accountId = response1.body.data.id;

    // Second request returns the same account
    const response2 = await request(app).get('/api/v1/auth/me');
    expect(response2.status).toBe(200);
    expect(response2.body.data.id).toBe(accountId);
  });

  it('returns 403 for suspended account', async () => {
    const suspended = Account.reconstitute({
      id: 'suspended-id',
      clerkUserId: 'user_mock_001',
      email: 'mock@example.com',
      displayName: 'Mock User',
      status: 'suspended',
      roles: ['backer'],
      onboardingCompleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    accountRepo.seed(suspended);

    const response = await request(app).get('/api/v1/auth/me');

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('ACCOUNT_SUSPENDED');
  });

  it('returns 403 for deleted account', async () => {
    const deleted = Account.reconstitute({
      id: 'deleted-id',
      clerkUserId: 'user_mock_001',
      email: 'mock@example.com',
      displayName: 'Mock User',
      status: 'deleted',
      roles: ['backer'],
      onboardingCompleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    accountRepo.seed(deleted);

    const response = await request(app).get('/api/v1/auth/me');

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('ACCOUNT_DELETED');
  });
});

describe('POST /api/webhooks/clerk', () => {
  let accountRepo: InMemoryAccountRepository;
  let app: express.Express;

  beforeEach(() => {
    accountRepo = new InMemoryAccountRepository();
    app = createApp(createTestDeps(accountRepo));
  });

  it('user.created event creates account row', async () => {
    const event = {
      type: 'user.created',
      data: {
        id: 'user_webhook_001',
        email_addresses: [{ email_address: 'webhook@marsmission.fund' }],
        first_name: 'Webhook',
        last_name: 'User',
      },
    };

    const response = await request(app)
      .post('/api/webhooks/clerk')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(event));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ received: true });

    // Verify account was created
    const accounts = accountRepo.getAll();
    expect(accounts.length).toBe(1);
    expect(accounts[0]?.clerkUserId).toBe('user_webhook_001');
    expect(accounts[0]?.email).toBe('webhook@marsmission.fund');
    expect(accounts[0]?.displayName).toBe('Webhook User');
  });

  it('user.updated event updates account row', async () => {
    // First create via user.created
    const createEvent = {
      type: 'user.created',
      data: {
        id: 'user_webhook_002',
        email_addresses: [{ email_address: 'original@marsmission.fund' }],
        first_name: 'Original',
        last_name: 'Name',
      },
    };

    await request(app)
      .post('/api/webhooks/clerk')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(createEvent));

    // Then update
    const updateEvent = {
      type: 'user.updated',
      data: {
        id: 'user_webhook_002',
        email_addresses: [{ email_address: 'updated@marsmission.fund' }],
        first_name: 'Updated',
        last_name: 'Name',
      },
    };

    const response = await request(app)
      .post('/api/webhooks/clerk')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(updateEvent));

    expect(response.status).toBe(200);

    const accounts = accountRepo.getAll();
    expect(accounts.length).toBe(1);
    expect(accounts[0]?.email).toBe('updated@marsmission.fund');
    expect(accounts[0]?.displayName).toBe('Updated Name');
  });

  it('user.deleted event sets status to deleted', async () => {
    // Create an account first
    const createEvent = {
      type: 'user.created',
      data: {
        id: 'user_webhook_003',
        email_addresses: [{ email_address: 'todelete@marsmission.fund' }],
        first_name: 'To',
        last_name: 'Delete',
      },
    };

    await request(app)
      .post('/api/webhooks/clerk')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(createEvent));

    // Delete
    const deleteEvent = {
      type: 'user.deleted',
      data: {
        id: 'user_webhook_003',
        email_addresses: [],
        first_name: null,
        last_name: null,
      },
    };

    const response = await request(app)
      .post('/api/webhooks/clerk')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(deleteEvent));

    expect(response.status).toBe(200);

    const accounts = accountRepo.getAll();
    expect(accounts.length).toBe(1);
    expect(accounts[0]?.status).toBe('deleted');
  });

  it('duplicate user.created is idempotent', async () => {
    const event = {
      type: 'user.created',
      data: {
        id: 'user_webhook_004',
        email_addresses: [{ email_address: 'duplicate@marsmission.fund' }],
        first_name: 'Duplicate',
        last_name: 'Test',
      },
    };

    // Send twice
    await request(app)
      .post('/api/webhooks/clerk')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(event));

    const response = await request(app)
      .post('/api/webhooks/clerk')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(event));

    expect(response.status).toBe(200);

    const accounts = accountRepo.getAll();
    expect(accounts.length).toBe(1);
  });

  it('user.updated for non-existent user creates via upsert', async () => {
    const event = {
      type: 'user.updated',
      data: {
        id: 'user_webhook_005',
        email_addresses: [{ email_address: 'upsert@marsmission.fund' }],
        first_name: 'Upsert',
        last_name: 'Test',
      },
    };

    const response = await request(app)
      .post('/api/webhooks/clerk')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(event));

    expect(response.status).toBe(200);

    const accounts = accountRepo.getAll();
    expect(accounts.length).toBe(1);
    expect(accounts[0]?.clerkUserId).toBe('user_webhook_005');
  });

  it('user.deleted for non-existent account is no-op', async () => {
    const event = {
      type: 'user.deleted',
      data: {
        id: 'user_nonexistent',
        email_addresses: [],
        first_name: null,
        last_name: null,
      },
    };

    const response = await request(app)
      .post('/api/webhooks/clerk')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(event));

    expect(response.status).toBe(200);
    expect(accountRepo.getAll().length).toBe(0);
  });
});

describe('Mock auth adapter', () => {
  it('always returns mock user context', async () => {
    const accountRepo = new InMemoryAccountRepository();
    const app = createApp(createTestDeps(accountRepo));

    const response = await request(app).get('/api/v1/auth/me');

    expect(response.status).toBe(200);
    expect(response.body.data.email).toBe('mock@example.com');
  });
});

describe('InMemoryAccountRepository', () => {
  let repo: InMemoryAccountRepository;

  beforeEach(() => {
    repo = new InMemoryAccountRepository();
  });

  it('findByClerkUserId returns account when found', async () => {
    const account = Account.create({
      clerkUserId: 'user_repo_001',
      email: 'repo@marsmission.fund',
      displayName: 'Repo Test',
    });
    repo.seed(account);

    const found = await repo.findByClerkUserId('user_repo_001');
    expect(found).not.toBeNull();
    expect(found?.id).toBe(account.id);
  });

  it('findByClerkUserId returns null when not found', async () => {
    const found = await repo.findByClerkUserId('user_nonexistent');
    expect(found).toBeNull();
  });

  it('save inserts new account', async () => {
    const account = Account.create({
      clerkUserId: 'user_repo_002',
      email: 'save@marsmission.fund',
    });
    await repo.save(account);

    const found = await repo.findByClerkUserId('user_repo_002');
    expect(found).not.toBeNull();
    expect(found?.email).toBe('save@marsmission.fund');
  });

  it('upsertFromWebhook inserts when new, updates when existing', async () => {
    // Insert
    await repo.upsertFromWebhook({
      clerkUserId: 'user_repo_003',
      email: 'upsert-original@marsmission.fund',
      displayName: 'Original',
    });

    let found = await repo.findByClerkUserId('user_repo_003');
    expect(found).not.toBeNull();
    expect(found?.email).toBe('upsert-original@marsmission.fund');

    // Update
    await repo.upsertFromWebhook({
      clerkUserId: 'user_repo_003',
      email: 'upsert-updated@marsmission.fund',
      displayName: 'Updated',
    });

    found = await repo.findByClerkUserId('user_repo_003');
    expect(found).not.toBeNull();
    expect(found?.email).toBe('upsert-updated@marsmission.fund');
    expect(found?.displayName).toBe('Updated');

    // Still only one account
    expect(repo.getAll().length).toBe(1);
  });
});
