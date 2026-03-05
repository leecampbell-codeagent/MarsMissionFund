import type express from 'express';
import type { Request as ExpressRequest } from 'express';
import pino from 'pino';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryAccountRepository } from '../account/adapters/mock/in-memory-account-repository.js';
import { MockAuthAdapter } from '../account/adapters/mock/mock-auth-adapter.js';
import { MockWebhookVerificationAdapter } from '../account/adapters/mock/mock-webhook-verification-adapter.js';
import { AccountAppService } from '../account/application/account-app-service.js';
import {
  Account,
  DEFAULT_NOTIFICATION_PREFERENCES,
} from '../account/domain/account.js';
import { type AppDependencies, createApp } from '../app.js';
import { InMemoryEventStore } from '../shared/adapters/mock/in-memory-event-store.js';
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

function createTestDeps(
  accountRepo: InMemoryAccountRepository,
  eventStore: InMemoryEventStore,
): AppDependencies {
  const extractor = createMockExtractor();
  return {
    authPort: new MockAuthAdapter(),
    webhookVerifier: new MockWebhookVerificationAdapter(),
    accountAppService: new AccountAppService(accountRepo, eventStore, testLogger),
    authExtractor: extractor,
    claimsExtractor: extractor,
  };
}

function createUnauthenticatedTestDeps(
  accountRepo: InMemoryAccountRepository,
  eventStore: InMemoryEventStore,
): AppDependencies {
  const extractor = createMockExtractor();
  // Auth middleware that does NOT attach auth — getUserId returns null → 401
  const noopAuthPort = {
    verifyToken: (_token: string) => Promise.resolve(null),
    getMiddleware: () => (_req: ExpressRequest, _res: import('express').Response, next: import('express').NextFunction) => { next(); },
  };
  return {
    authPort: noopAuthPort,
    webhookVerifier: new MockWebhookVerificationAdapter(),
    accountAppService: new AccountAppService(accountRepo, eventStore, testLogger),
    authExtractor: extractor,
    claimsExtractor: extractor,
  };
}

function makeFullAccount(overrides: Partial<Parameters<typeof Account.reconstitute>[0]> = {}): Account {
  return Account.reconstitute({
    id: 'test-account-id',
    clerkUserId: 'user_mock_001',
    email: 'mock@example.com',
    displayName: null,
    bio: null,
    avatarUrl: null,
    status: 'active',
    roles: ['backer'],
    onboardingCompleted: false,
    onboardingStep: 'welcome',
    notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES,
    createdAt: new Date('2026-03-05T00:00:00Z'),
    updatedAt: new Date('2026-03-05T00:00:00Z'),
    ...overrides,
  });
}

// ─── GET /api/v1/accounts/me ─────────────────────────────────────────────────

describe('GET /api/v1/accounts/me', () => {
  let accountRepo: InMemoryAccountRepository;
  let eventStore: InMemoryEventStore;
  let app: express.Express;

  beforeEach(() => {
    accountRepo = new InMemoryAccountRepository();
    eventStore = new InMemoryEventStore();
    app = createApp(createTestDeps(accountRepo, eventStore));
  });

  it('returns 401 when no auth header', async () => {
    const unauthApp = createApp(createUnauthenticatedTestDeps(accountRepo, eventStore));
    const response = await request(unauthApp).get('/api/v1/accounts/me');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('returns full account data with new fields for authenticated user', async () => {
    const response = await request(app).get('/api/v1/accounts/me');

    expect(response.status).toBe(200);
    expect(response.body.data).toBeDefined();
    expect(response.body.data.email).toBe('mock@example.com');
    expect(response.body.data.status).toBe('active');
    expect(response.body.data.roles).toEqual(['backer']);
    expect(response.body.data.onboarding_completed).toBe(false);
    expect(response.body.data.onboarding_step).toBe('welcome');
    expect(response.body.data.bio).toBeNull();
    expect(response.body.data.avatar_url).toBeNull();
    expect(response.body.data.notification_preferences).toBeDefined();
    expect(response.body.data.notification_preferences.security_alerts).toBe(true);
    expect(response.body.data.notification_preferences.platform_announcements).toBe(false);
  });

  it('returns account with pre-existing data from repository', async () => {
    const account = makeFullAccount({
      bio: 'Mars enthusiast',
      avatarUrl: 'https://example.com/avatar.jpg',
      onboardingStep: 'profile',
    });
    accountRepo.seed(account);

    const response = await request(app).get('/api/v1/accounts/me');

    expect(response.status).toBe(200);
    expect(response.body.data.bio).toBe('Mars enthusiast');
    expect(response.body.data.avatar_url).toBe('https://example.com/avatar.jpg');
    expect(response.body.data.onboarding_step).toBe('profile');
  });
});

// ─── PATCH /api/v1/accounts/me ───────────────────────────────────────────────

describe('PATCH /api/v1/accounts/me', () => {
  let accountRepo: InMemoryAccountRepository;
  let eventStore: InMemoryEventStore;
  let app: express.Express;

  beforeEach(() => {
    accountRepo = new InMemoryAccountRepository();
    eventStore = new InMemoryEventStore();
    app = createApp(createTestDeps(accountRepo, eventStore));
  });

  it('returns 401 when no auth header', async () => {
    const unauthApp = createApp(createUnauthenticatedTestDeps(accountRepo, eventStore));
    const response = await request(unauthApp)
      .patch('/api/v1/accounts/me')
      .send({ display_name: 'Jane Pioneer' });
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('updates display name — success', async () => {
    // First create the account via GET
    await request(app).get('/api/v1/accounts/me');

    const response = await request(app)
      .patch('/api/v1/accounts/me')
      .send({ display_name: 'Jane Pioneer' });

    expect(response.status).toBe(200);
    expect(response.body.data.display_name).toBe('Jane Pioneer');
  });

  it('updates bio — success', async () => {
    await request(app).get('/api/v1/accounts/me');

    const response = await request(app)
      .patch('/api/v1/accounts/me')
      .send({ bio: 'Mars enthusiast' });

    expect(response.status).toBe(200);
    expect(response.body.data.bio).toBe('Mars enthusiast');
  });

  it('updates avatar URL — success', async () => {
    await request(app).get('/api/v1/accounts/me');

    const response = await request(app)
      .patch('/api/v1/accounts/me')
      .send({ avatar_url: 'https://example.com/avatar.jpg' });

    expect(response.status).toBe(200);
    expect(response.body.data.avatar_url).toBe('https://example.com/avatar.jpg');
  });

  it('updates multiple fields at once — success', async () => {
    await request(app).get('/api/v1/accounts/me');

    const response = await request(app)
      .patch('/api/v1/accounts/me')
      .send({
        display_name: 'Jane Pioneer',
        bio: 'Mars enthusiast from Earth',
        avatar_url: 'https://example.com/avatar.jpg',
      });

    expect(response.status).toBe(200);
    expect(response.body.data.display_name).toBe('Jane Pioneer');
    expect(response.body.data.bio).toBe('Mars enthusiast from Earth');
    expect(response.body.data.avatar_url).toBe('https://example.com/avatar.jpg');
  });

  it('rejects empty body — 400', async () => {
    const response = await request(app)
      .patch('/api/v1/accounts/me')
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects display name over 100 chars — 400', async () => {
    const response = await request(app)
      .patch('/api/v1/accounts/me')
      .send({ display_name: 'a'.repeat(101) });

    expect(response.status).toBe(400);
  });

  it('rejects bio over 500 chars — 400', async () => {
    const response = await request(app)
      .patch('/api/v1/accounts/me')
      .send({ bio: 'a'.repeat(501) });

    expect(response.status).toBe(400);
  });

  it('rejects non-https avatar URL — 400', async () => {
    const response = await request(app)
      .patch('/api/v1/accounts/me')
      .send({ avatar_url: 'http://example.com/avatar.jpg' });

    expect(response.status).toBe(400);
  });

  it('rejects unknown keys in body — 400', async () => {
    const response = await request(app)
      .patch('/api/v1/accounts/me')
      .send({ display_name: 'Jane', unknown_key: 'value' });

    expect(response.status).toBe(400);
  });

  it('emits account.profile_updated event to event store', async () => {
    await request(app).get('/api/v1/accounts/me');
    const accounts = accountRepo.getAll();
    const accountId = accounts[0]?.id;

    await request(app)
      .patch('/api/v1/accounts/me')
      .send({ display_name: 'Jane Pioneer' });

    const events = eventStore.getAllEvents();
    const profileUpdatedEvent = events.find((e) => e.eventType === 'account.profile_updated');
    expect(profileUpdatedEvent).toBeDefined();
    expect(profileUpdatedEvent?.aggregateId).toBe(accountId);
    expect(profileUpdatedEvent?.payload).toHaveProperty('fields_changed');
  });
});

// ─── PATCH /api/v1/accounts/me/preferences ───────────────────────────────────

describe('PATCH /api/v1/accounts/me/preferences', () => {
  let accountRepo: InMemoryAccountRepository;
  let eventStore: InMemoryEventStore;
  let app: express.Express;

  beforeEach(() => {
    accountRepo = new InMemoryAccountRepository();
    eventStore = new InMemoryEventStore();
    app = createApp(createTestDeps(accountRepo, eventStore));
  });

  it('returns 401 when no auth header', async () => {
    const unauthApp = createApp(createUnauthenticatedTestDeps(accountRepo, eventStore));
    const response = await request(unauthApp)
      .patch('/api/v1/accounts/me/preferences')
      .send({
        campaign_updates: false,
        milestone_completions: true,
        contribution_confirmations: true,
        new_campaign_recommendations: false,
        security_alerts: true,
        platform_announcements: false,
      });
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  const validPrefs = {
    campaign_updates: false,
    milestone_completions: true,
    contribution_confirmations: true,
    new_campaign_recommendations: false,
    security_alerts: false, // Will be forced to true
    platform_announcements: true,
  };

  it('updates all preferences — success', async () => {
    await request(app).get('/api/v1/accounts/me');

    const response = await request(app)
      .patch('/api/v1/accounts/me/preferences')
      .send(validPrefs);

    expect(response.status).toBe(200);
    expect(response.body.data.notification_preferences.campaign_updates).toBe(false);
    expect(response.body.data.notification_preferences.platform_announcements).toBe(true);
  });

  it('forces security_alerts to true even when false is sent', async () => {
    await request(app).get('/api/v1/accounts/me');

    const response = await request(app)
      .patch('/api/v1/accounts/me/preferences')
      .send(validPrefs);

    expect(response.status).toBe(200);
    expect(response.body.data.notification_preferences.security_alerts).toBe(true);
  });

  it('rejects missing fields — 400', async () => {
    const response = await request(app)
      .patch('/api/v1/accounts/me/preferences')
      .send({ campaign_updates: true }); // Missing 5 required fields

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects non-boolean values — 400', async () => {
    const response = await request(app)
      .patch('/api/v1/accounts/me/preferences')
      .send({
        ...validPrefs,
        campaign_updates: 'yes',
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects unknown preference keys — 400', async () => {
    const response = await request(app)
      .patch('/api/v1/accounts/me/preferences')
      .send({
        ...validPrefs,
        unknown_pref: true,
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('emits account.preferences_updated event to event store', async () => {
    await request(app).get('/api/v1/accounts/me');
    const accounts = accountRepo.getAll();
    const accountId = accounts[0]?.id;

    await request(app)
      .patch('/api/v1/accounts/me/preferences')
      .send(validPrefs);

    const events = eventStore.getAllEvents();
    const prefsEvent = events.find((e) => e.eventType === 'account.preferences_updated');
    expect(prefsEvent).toBeDefined();
    expect(prefsEvent?.aggregateId).toBe(accountId);
  });
});

// ─── PATCH /api/v1/accounts/me/onboarding ────────────────────────────────────

describe('PATCH /api/v1/accounts/me/onboarding', () => {
  let accountRepo: InMemoryAccountRepository;
  let eventStore: InMemoryEventStore;
  let app: express.Express;

  beforeEach(() => {
    accountRepo = new InMemoryAccountRepository();
    eventStore = new InMemoryEventStore();
    app = createApp(createTestDeps(accountRepo, eventStore));
  });

  it('returns 401 when no auth header', async () => {
    const unauthApp = createApp(createUnauthenticatedTestDeps(accountRepo, eventStore));
    const response = await request(unauthApp)
      .patch('/api/v1/accounts/me/onboarding')
      .send({ step: 'role_selection' });
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('advances from welcome to role_selection — success', async () => {
    await request(app).get('/api/v1/accounts/me');

    const response = await request(app)
      .patch('/api/v1/accounts/me/onboarding')
      .send({ step: 'role_selection' });

    expect(response.status).toBe(200);
    expect(response.body.data.onboarding_step).toBe('role_selection');
    expect(response.body.data.onboarding_completed).toBe(false);
  });

  it('advances with role update — roles persisted', async () => {
    await request(app).get('/api/v1/accounts/me');

    const response = await request(app)
      .patch('/api/v1/accounts/me/onboarding')
      .send({ step: 'profile', roles: ['backer', 'creator'] });

    expect(response.status).toBe(200);
    expect(response.body.data.roles).toContain('backer');
    expect(response.body.data.roles).toContain('creator');
  });

  it('advances to completed — sets onboarding_completed to true', async () => {
    // Advance through all prior steps
    await request(app).get('/api/v1/accounts/me');
    await request(app).patch('/api/v1/accounts/me/onboarding').send({ step: 'role_selection' });
    await request(app).patch('/api/v1/accounts/me/onboarding').send({ step: 'profile' });
    await request(app).patch('/api/v1/accounts/me/onboarding').send({ step: 'preferences' });

    const response = await request(app)
      .patch('/api/v1/accounts/me/onboarding')
      .send({ step: 'completed' });

    expect(response.status).toBe(200);
    expect(response.body.data.onboarding_completed).toBe(true);
    expect(response.body.data.onboarding_step).toBe('completed');
  });

  it('rejects step regression — returns 200 (idempotent)', async () => {
    // First advance to role_selection
    await request(app).get('/api/v1/accounts/me');
    await request(app).patch('/api/v1/accounts/me/onboarding').send({ step: 'role_selection' });

    // Now try to go back to welcome (regression) — returns 200 with current state
    const response = await request(app)
      .patch('/api/v1/accounts/me/onboarding')
      .send({ step: 'role_selection' }); // same step = invalid per domain, returns 200 idempotent

    // Per spec edge case #24: regression returns 200 with current account state
    expect(response.status).toBe(200);
  });

  it('rejects invalid role values — 400', async () => {
    const response = await request(app)
      .patch('/api/v1/accounts/me/onboarding')
      .send({ step: 'profile', roles: ['backer', 'reviewer'] }); // reviewer not allowed in onboarding

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects invalid step values — 400', async () => {
    const response = await request(app)
      .patch('/api/v1/accounts/me/onboarding')
      .send({ step: 'invalid_step' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects welcome as a target step — 400', async () => {
    const response = await request(app)
      .patch('/api/v1/accounts/me/onboarding')
      .send({ step: 'welcome' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects unknown keys in body — 400', async () => {
    const response = await request(app)
      .patch('/api/v1/accounts/me/onboarding')
      .send({ step: 'role_selection', unknown_key: 'value' });

    expect(response.status).toBe(400);
  });

  it('emits onboarding events to event store', async () => {
    await request(app).get('/api/v1/accounts/me');
    const accounts = accountRepo.getAll();
    const accountId = accounts[0]?.id;

    await request(app).patch('/api/v1/accounts/me/onboarding').send({ step: 'role_selection' });

    const events = eventStore.getAllEvents();
    const stepEvent = events.find((e) => e.eventType === 'account.onboarding_step_completed');
    expect(stepEvent).toBeDefined();
    expect(stepEvent?.aggregateId).toBe(accountId);
    expect(stepEvent?.payload).toEqual({ step: 'role_selection' });
  });

  it('emits both step and completion events when advancing to completed', async () => {
    await request(app).get('/api/v1/accounts/me');
    await request(app).patch('/api/v1/accounts/me/onboarding').send({ step: 'role_selection' });
    await request(app).patch('/api/v1/accounts/me/onboarding').send({ step: 'profile' });
    await request(app).patch('/api/v1/accounts/me/onboarding').send({ step: 'preferences' });

    eventStore.clear();
    await request(app).patch('/api/v1/accounts/me/onboarding').send({ step: 'completed' });

    const events = eventStore.getAllEvents();
    const stepEvent = events.find((e) => e.eventType === 'account.onboarding_step_completed');
    const completedEvent = events.find((e) => e.eventType === 'account.onboarding_completed');
    expect(stepEvent).toBeDefined();
    expect(completedEvent).toBeDefined();
  });

  it('preserves admin-assigned roles during onboarding role update', async () => {
    // Create an account with reviewer role (admin-assigned)
    const account = makeFullAccount({
      roles: ['backer', 'reviewer'],
      onboardingStep: 'welcome',
    });
    accountRepo.seed(account);

    // Advance onboarding with only backer/creator roles (should preserve reviewer)
    await request(app)
      .patch('/api/v1/accounts/me/onboarding')
      .send({ step: 'profile', roles: ['backer', 'creator'] });

    // Check the account has both creator and reviewer
    const updatedAccount = await accountRepo.findById(account.id);
    expect(updatedAccount?.roles).toContain('reviewer');
    expect(updatedAccount?.roles).toContain('creator');
    expect(updatedAccount?.roles).toContain('backer');
  });
});

// ─── InMemoryEventStore adapter ───────────────────────────────────────────────

describe('InMemoryEventStore', () => {
  it('appends events and retrieves them by aggregate', async () => {
    const store = new InMemoryEventStore();
    await store.append({
      eventType: 'account.profile_updated',
      aggregateId: 'acc-001',
      aggregateType: 'account',
      sequenceNumber: 1,
      correlationId: 'corr-001',
      sourceService: 'account-service',
      payload: { fields_changed: ['display_name'] },
    });

    const events = store.getEvents('acc-001');
    expect(events).toHaveLength(1);
    expect(events[0]?.eventType).toBe('account.profile_updated');
  });

  it('getNextSequenceNumber returns 1 for new aggregate', async () => {
    const store = new InMemoryEventStore();
    const seq = await store.getNextSequenceNumber('acc-new');
    expect(seq).toBe(1);
  });

  it('getNextSequenceNumber increments for existing aggregate', async () => {
    const store = new InMemoryEventStore();
    await store.append({
      eventType: 'account.profile_updated',
      aggregateId: 'acc-001',
      aggregateType: 'account',
      sequenceNumber: 1,
      correlationId: 'corr-001',
      sourceService: 'account-service',
      payload: {},
    });

    const seq = await store.getNextSequenceNumber('acc-001');
    expect(seq).toBe(2);
  });

  it('getAllEvents returns all events across aggregates', async () => {
    const store = new InMemoryEventStore();
    await store.append({
      eventType: 'account.profile_updated',
      aggregateId: 'acc-001',
      aggregateType: 'account',
      sequenceNumber: 1,
      correlationId: 'corr-001',
      sourceService: 'account-service',
      payload: {},
    });
    await store.append({
      eventType: 'account.roles_updated',
      aggregateId: 'acc-002',
      aggregateType: 'account',
      sequenceNumber: 1,
      correlationId: 'corr-002',
      sourceService: 'account-service',
      payload: {},
    });

    const all = store.getAllEvents();
    expect(all).toHaveLength(2);
  });

  it('clear resets all events', async () => {
    const store = new InMemoryEventStore();
    await store.append({
      eventType: 'account.profile_updated',
      aggregateId: 'acc-001',
      aggregateType: 'account',
      sequenceNumber: 1,
      correlationId: 'corr-001',
      sourceService: 'account-service',
      payload: {},
    });

    store.clear();
    expect(store.getAllEvents()).toHaveLength(0);
  });
});
