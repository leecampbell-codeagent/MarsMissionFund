import pino from 'pino';
import { describe, expect, it } from 'vitest';
import { InMemoryUserRepository } from '../adapters/in-memory-user-repository.adapter.js';
import { MockAuditLogger } from '../adapters/mock-audit-logger.adapter.js';
import { MockClerkAuthAdapter } from '../adapters/mock-clerk-auth.adapter.js';
import {
  DisplayNameTooLongError,
  SecurityAlertsCannotBeDisabledError,
  UserNotFoundError,
} from '../domain/errors/account-errors.js';
import { User, type UserData } from '../domain/models/user.js';
import { AccountStatus } from '../domain/value-objects/account-status.js';
import { KycStatus } from '../domain/value-objects/kyc-status.js';
import { NotificationPreferences } from '../domain/value-objects/notification-preferences.js';
import { Role } from '../domain/value-objects/role.js';
import { AuditActions } from '../ports/audit-logger.port.js';
import { AccountAppService } from './account-app-service.js';

// Silent pino logger for tests
const logger = pino({ level: 'silent' });

function makeService() {
  const userRepository = new InMemoryUserRepository();
  const clerkAuth = new MockClerkAuthAdapter();
  const auditLogger = new MockAuditLogger();
  const service = new AccountAppService(userRepository, clerkAuth, auditLogger, logger);
  return { service, userRepository, clerkAuth, auditLogger };
}

function seedUser(
  repo: InMemoryUserRepository,
  clerkUserId: string,
  overrides: Partial<UserData> = {},
) {
  const data: UserData = { ...makeDefaultUserData(clerkUserId), ...overrides };
  const user = User.reconstitute(data);
  repo.users.set(clerkUserId, user);
  return user;
}

function makeDefaultUserData(clerkUserId: string) {
  return {
    id: `id-${clerkUserId}`,
    clerkUserId,
    email: `${clerkUserId}@test.mmf`,
    displayName: null as string | null,
    bio: null as string | null,
    avatarUrl: null as string | null,
    accountStatus: AccountStatus.Active,
    onboardingCompleted: false,
    onboardingStep: null,
    roles: [Role.Backer] as Role[],
    notificationPrefs: NotificationPreferences.defaults(),
    kycStatus: KycStatus.NotStarted,
    lastSeenAt: null as Date | null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };
}

describe('AccountAppService.syncUser()', () => {
  it('creates new user when clerkUserId not found', async () => {
    const { service, userRepository } = makeService();
    const user = await service.syncUser({
      clerkUserId: 'user_new123',
      email: 'new@example.com',
      accountStatus: AccountStatus.PendingVerification,
    });
    expect(user.clerkUserId).toBe('user_new123');
    expect(user.email).toBe('new@example.com');
    expect(userRepository.users.has('user_new123')).toBe(true);
  });

  it('upserts existing user — updates email, does not reset roles', async () => {
    const { service, userRepository } = makeService();
    seedUser(userRepository, 'user_existing', {
      email: 'old@example.com',
      roles: [Role.Backer, Role.Creator],
    });

    const user = await service.syncUser({
      clerkUserId: 'user_existing',
      email: 'new@example.com',
      accountStatus: AccountStatus.Active,
    });

    expect(user.email).toBe('new@example.com');
    // Roles are preserved by upsert semantics
    expect(user.roles).toContain(Role.Backer);
  });

  it('normalises email to lowercase and trimmed', async () => {
    const { service } = makeService();
    const user = await service.syncUser({
      clerkUserId: 'user_normalize',
      email: '  USER@EXAMPLE.COM  ',
      accountStatus: AccountStatus.Active,
    });
    expect(user.email).toBe('user@example.com');
  });

  it('calls auditLogger.log with action user.synced', async () => {
    const { service, auditLogger } = makeService();
    await service.syncUser({
      clerkUserId: 'user_audit',
      email: 'audit@example.com',
      accountStatus: AccountStatus.Active,
    });
    const entry = auditLogger.entries.find((e) => e.action === AuditActions.UserSynced);
    expect(entry).toBeDefined();
    expect(entry!.actorClerkUserId).toBe('user_audit');
  });

  it('assigns Backer role when accountStatus is Active (WARN-005)', async () => {
    const { service } = makeService();
    const user = await service.syncUser({
      clerkUserId: 'user_active_new',
      email: 'active@example.com',
      accountStatus: AccountStatus.Active,
    });
    // WARN-005: Active user should have Backer role
    expect(user.roles).toContain(Role.Backer);
  });
});

describe('AccountAppService.getMe()', () => {
  it('returns user for valid clerkUserId', async () => {
    const { service, userRepository } = makeService();
    seedUser(userRepository, 'user_getme');
    const user = await service.getMe('user_getme');
    expect(user.clerkUserId).toBe('user_getme');
  });

  it('throws UserNotFoundError for unknown clerkUserId', async () => {
    const { service } = makeService();
    await expect(service.getMe('user_unknown')).rejects.toThrow(UserNotFoundError);
  });
});

describe('AccountAppService.updateProfile()', () => {
  it('updates fields and calls audit log', async () => {
    const { service, userRepository, auditLogger } = makeService();
    seedUser(userRepository, 'user_profile');

    const updated = await service.updateProfile('user_profile', {
      displayName: 'Ada Lovelace',
      bio: 'Mars pioneer',
    });

    expect(updated.displayName).toBe('Ada Lovelace');
    expect(updated.bio).toBe('Mars pioneer');

    const entry = auditLogger.entries.find((e) => e.action === AuditActions.ProfileUpdated);
    expect(entry).toBeDefined();
  });

  it('throws UserNotFoundError for unknown user', async () => {
    const { service } = makeService();
    await expect(service.updateProfile('user_unknown', { displayName: 'Test' })).rejects.toThrow(
      UserNotFoundError,
    );
  });

  it('propagates DisplayNameTooLongError for displayName > 255 chars', async () => {
    const { service, userRepository } = makeService();
    seedUser(userRepository, 'user_toolong');

    await expect(
      service.updateProfile('user_toolong', { displayName: 'a'.repeat(256) }),
    ).rejects.toThrow(DisplayNameTooLongError);
  });
});

describe('AccountAppService.updateNotificationPrefs()', () => {
  it('merges and persists preferences', async () => {
    const { service, userRepository } = makeService();
    seedUser(userRepository, 'user_notif');

    const prefs = await service.updateNotificationPrefs('user_notif', {
      recommendations: false,
    });

    expect(prefs.recommendations).toBe(false);
    expect(prefs.securityAlerts).toBe(true);
  });

  it('throws SecurityAlertsCannotBeDisabledError when securityAlerts is false', async () => {
    const { service, userRepository } = makeService();
    seedUser(userRepository, 'user_secure');

    await expect(
      service.updateNotificationPrefs('user_secure', {
        securityAlerts: false as never,
      }),
    ).rejects.toThrow(SecurityAlertsCannotBeDisabledError);
  });
});

describe('AccountAppService.handleClerkWebhook()', () => {
  it('user.created — creates user with pending_verification for unverified email', async () => {
    const { service, userRepository } = makeService();

    await service.handleClerkWebhook({
      type: 'user.created',
      data: {
        id: 'user_webhook1',
        email_addresses: [
          {
            email_address: 'webhook1@example.com',
            verification: { status: 'unverified' },
          },
        ],
      },
    });

    const user = userRepository.users.get('user_webhook1');
    expect(user).toBeDefined();
    expect(user!.accountStatus).toBe(AccountStatus.PendingVerification);
    expect(user!.roles).toEqual([]);
  });

  it('user.created — creates user with active status and backer role for verified email', async () => {
    const { service, userRepository } = makeService();

    await service.handleClerkWebhook({
      type: 'user.created',
      data: {
        id: 'user_webhook2',
        email_addresses: [
          {
            email_address: 'webhook2@example.com',
            verification: { status: 'verified' },
          },
        ],
      },
    });

    const user = userRepository.users.get('user_webhook2');
    expect(user!.accountStatus).toBe(AccountStatus.Active);
    expect(user!.roles).toContain(Role.Backer);
  });

  it('user.created — is idempotent (second call does not downgrade active user)', async () => {
    const { service, userRepository } = makeService();

    // First call: creates active user
    await service.handleClerkWebhook({
      type: 'user.created',
      data: {
        id: 'user_idem',
        email_addresses: [
          {
            email_address: 'idem@example.com',
            verification: { status: 'verified' },
          },
        ],
      },
    });

    // Second call: should not downgrade
    await service.handleClerkWebhook({
      type: 'user.created',
      data: {
        id: 'user_idem',
        email_addresses: [
          {
            email_address: 'idem@example.com',
            verification: { status: 'unverified' },
          },
        ],
      },
    });

    const user = userRepository.users.get('user_idem');
    // Status preserved from first call (upsert does not overwrite account_status)
    expect(user!.accountStatus).toBe(AccountStatus.Active);
  });

  it('user.updated — activates user and sets backer role when email becomes verified', async () => {
    const { service, userRepository } = makeService();
    seedUser(userRepository, 'user_activate', {
      accountStatus: AccountStatus.PendingVerification,
      roles: [],
    });

    await service.handleClerkWebhook({
      type: 'user.updated',
      data: {
        id: 'user_activate',
        email_addresses: [
          {
            email_address: `user_activate@test.mmf`,
            verification: { status: 'verified' },
          },
        ],
      },
    });

    const user = userRepository.users.get('user_activate');
    expect(user!.accountStatus).toBe(AccountStatus.Active);
    expect(user!.roles).toContain(Role.Backer);
  });

  it('user.updated — does NOT activate already-active user', async () => {
    const { service, userRepository, auditLogger } = makeService();
    seedUser(userRepository, 'user_already_active', {
      accountStatus: AccountStatus.Active,
      roles: [Role.Backer, Role.Creator],
    });

    await service.handleClerkWebhook({
      type: 'user.updated',
      data: {
        id: 'user_already_active',
        email_addresses: [
          {
            email_address: 'user_already_active@test.mmf',
            verification: { status: 'verified' },
          },
        ],
      },
    });

    // No account.activated event should be logged
    const activatedEntries = auditLogger.entries.filter(
      (e) => e.action === AuditActions.AccountActivated,
    );
    expect(activatedEntries).toHaveLength(0);

    // Roles preserved
    const user = userRepository.users.get('user_already_active');
    expect(user!.roles).toContain(Role.Creator);
  });

  it('user.updated — creates user if not found (out-of-order delivery)', async () => {
    const { service, userRepository } = makeService();

    // No user seeded — out-of-order delivery
    await service.handleClerkWebhook({
      type: 'user.updated',
      data: {
        id: 'user_outoforder',
        email_addresses: [
          {
            email_address: 'outoforder@example.com',
            verification: { status: 'verified' },
          },
        ],
      },
    });

    const user = userRepository.users.get('user_outoforder');
    expect(user).toBeDefined();
    expect(user!.accountStatus).toBe(AccountStatus.Active);
  });

  it('user.updated — updates email when email changed', async () => {
    const { service, userRepository } = makeService();
    seedUser(userRepository, 'user_emailchange', {
      email: 'old@example.com',
      accountStatus: AccountStatus.Active,
    });

    await service.handleClerkWebhook({
      type: 'user.updated',
      data: {
        id: 'user_emailchange',
        email_addresses: [
          {
            email_address: 'new@example.com',
            verification: { status: 'verified' },
          },
        ],
      },
    });

    const user = userRepository.users.get('user_emailchange');
    expect(user!.email).toBe('new@example.com');
  });
});

describe('AccountAppService.completeOnboarding()', () => {
  it('sets onboardingCompleted to true and onboardingStep to complete', async () => {
    const { service, userRepository } = makeService();
    seedUser(userRepository, 'user_complete_onboarding', {
      onboardingCompleted: false,
      onboardingStep: null,
    });

    const updated = await service.completeOnboarding('user_complete_onboarding');

    expect(updated.onboardingCompleted).toBe(true);
    expect(updated.onboardingStep).toBe('complete');
  });

  it('is idempotent — can be called on an already-completed user', async () => {
    const { service, userRepository } = makeService();
    seedUser(userRepository, 'user_already_complete', {
      onboardingCompleted: true,
      onboardingStep: 'complete',
    });

    const updated = await service.completeOnboarding('user_already_complete');

    expect(updated.onboardingCompleted).toBe(true);
    expect(updated.onboardingStep).toBe('complete');
  });

  it('throws UserNotFoundError for unknown clerkUserId', async () => {
    const { service } = makeService();
    await expect(service.completeOnboarding('user_unknown')).rejects.toThrow(UserNotFoundError);
  });

  it('calls auditLogger.log with action profile.updated', async () => {
    const { service, userRepository, auditLogger } = makeService();
    seedUser(userRepository, 'user_complete_audit');

    await service.completeOnboarding('user_complete_audit');

    const entry = auditLogger.entries.find((e) => e.action === AuditActions.ProfileUpdated);
    expect(entry).toBeDefined();
    expect(entry!.actorClerkUserId).toBe('user_complete_audit');
    expect(entry!.metadata).toMatchObject({ fields: ['onboardingCompleted', 'onboardingStep'] });
  });
});

describe('MockClerkAuthAdapter', () => {
  it('returns correct fixture for user_test_backer', async () => {
    const adapter = new MockClerkAuthAdapter();
    const metadata = await adapter.getUserMetadata('user_test_backer');
    expect(metadata.email).toBe('backer@test.mmf');
    expect(metadata.emailVerified).toBe(true);
  });

  it('throws UserNotFoundError for unknown ID', async () => {
    const adapter = new MockClerkAuthAdapter();
    await expect(adapter.getUserMetadata('user_unknown_xyz')).rejects.toThrow(UserNotFoundError);
  });

  it('setPublicMetadata resolves without error', async () => {
    const adapter = new MockClerkAuthAdapter();
    await expect(
      adapter.setPublicMetadata('user_any', { role: 'backer' }),
    ).resolves.toBeUndefined();
  });
});
