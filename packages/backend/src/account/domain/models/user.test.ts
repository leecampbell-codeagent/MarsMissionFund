import { describe, expect, it } from 'vitest';
import {
  AlreadyActiveError,
  BioTooLongError,
  CannotRemoveBackerRoleError,
  DisplayNameTooLongError,
  InvalidAvatarUrlError,
  InvalidClerkUserIdError,
  InvalidEmailError,
  RoleNotAssignedError,
  SecurityAlertsCannotBeDisabledError,
  SuperAdminAssignmentForbiddenError,
} from '../errors/account-errors.js';
import { AccountStatus } from '../value-objects/account-status.js';
import { KycStatus } from '../value-objects/kyc-status.js';
import { NotificationPreferences } from '../value-objects/notification-preferences.js';
import { Role } from '../value-objects/role.js';
import { User } from './user.js';

// Helper: build a valid base user
function baseUser() {
  return User.create({
    clerkUserId: 'user_test123',
    email: 'test@example.com',
    accountStatus: AccountStatus.PendingVerification,
  });
}

describe('User.create()', () => {
  it('creates a user with all optional fields present', () => {
    const user = User.create({
      clerkUserId: 'user_abc123',
      email: 'user@example.com',
      displayName: 'Ada Lovelace',
      bio: 'Mars enthusiast',
      avatarUrl: 'https://cdn.example.com/avatar.jpg',
      accountStatus: AccountStatus.Active,
    });

    expect(user.id).toBeDefined();
    expect(user.clerkUserId).toBe('user_abc123');
    expect(user.email).toBe('user@example.com');
    expect(user.displayName).toBe('Ada Lovelace');
    expect(user.bio).toBe('Mars enthusiast');
    expect(user.avatarUrl).toBe('https://cdn.example.com/avatar.jpg');
    expect(user.accountStatus).toBe(AccountStatus.Active);
    expect(user.roles).toEqual([]);
    expect(user.onboardingCompleted).toBe(false);
    expect(user.onboardingStep).toBeNull();
    expect(user.kycStatus).toBe(KycStatus.NotStarted);
    expect(user.lastSeenAt).toBeNull();
  });

  it('creates a user with no optional fields', () => {
    const user = baseUser();
    expect(user.id).toBeDefined();
    expect(user.displayName).toBeNull();
    expect(user.bio).toBeNull();
    expect(user.avatarUrl).toBeNull();
    expect(user.notificationPrefs).toEqual(NotificationPreferences.defaults());
  });

  it('normalises email to lowercase', () => {
    const user = User.create({
      clerkUserId: 'user_test123',
      email: '  User@EXAMPLE.COM  ',
      accountStatus: AccountStatus.Active,
    });
    expect(user.email).toBe('user@example.com');
  });

  it('throws InvalidClerkUserIdError for empty clerkUserId', () => {
    expect(() =>
      User.create({
        clerkUserId: '',
        email: 'test@example.com',
        accountStatus: AccountStatus.Active,
      }),
    ).toThrow(InvalidClerkUserIdError);
  });

  it('throws InvalidClerkUserIdError for whitespace-only clerkUserId', () => {
    expect(() =>
      User.create({
        clerkUserId: '   ',
        email: 'test@example.com',
        accountStatus: AccountStatus.Active,
      }),
    ).toThrow(InvalidClerkUserIdError);
  });

  it('throws InvalidEmailError for malformed email', () => {
    expect(() =>
      User.create({
        clerkUserId: 'user_test',
        email: 'not-an-email',
        accountStatus: AccountStatus.Active,
      }),
    ).toThrow(InvalidEmailError);
  });

  it('accepts displayName exactly 255 chars', () => {
    const name = 'a'.repeat(255);
    const user = User.create({
      clerkUserId: 'user_test',
      email: 'test@example.com',
      displayName: name,
      accountStatus: AccountStatus.Active,
    });
    expect(user.displayName).toBe(name);
  });

  it('throws DisplayNameTooLongError for displayName > 255 chars', () => {
    expect(() =>
      User.create({
        clerkUserId: 'user_test',
        email: 'test@example.com',
        displayName: 'a'.repeat(256),
        accountStatus: AccountStatus.Active,
      }),
    ).toThrow(DisplayNameTooLongError);
  });

  it('accepts bio exactly 500 chars', () => {
    const bio = 'b'.repeat(500);
    const user = User.create({
      clerkUserId: 'user_test',
      email: 'test@example.com',
      bio,
      accountStatus: AccountStatus.Active,
    });
    expect(user.bio).toBe(bio);
  });

  it('throws BioTooLongError for bio > 500 chars', () => {
    expect(() =>
      User.create({
        clerkUserId: 'user_test',
        email: 'test@example.com',
        bio: 'b'.repeat(501),
        accountStatus: AccountStatus.Active,
      }),
    ).toThrow(BioTooLongError);
  });

  it('accepts avatarUrl as valid absolute URL', () => {
    const user = User.create({
      clerkUserId: 'user_test',
      email: 'test@example.com',
      avatarUrl: 'https://cdn.example.com/avatar.png',
      accountStatus: AccountStatus.Active,
    });
    expect(user.avatarUrl).toBe('https://cdn.example.com/avatar.png');
  });

  it('throws InvalidAvatarUrlError for relative URL', () => {
    expect(() =>
      User.create({
        clerkUserId: 'user_test',
        email: 'test@example.com',
        avatarUrl: '/relative/path/avatar.png',
        accountStatus: AccountStatus.Active,
      }),
    ).toThrow(InvalidAvatarUrlError);
  });

  it('throws InvalidAvatarUrlError for non-URL string', () => {
    expect(() =>
      User.create({
        clerkUserId: 'user_test',
        email: 'test@example.com',
        avatarUrl: 'not-a-url',
        accountStatus: AccountStatus.Active,
      }),
    ).toThrow(InvalidAvatarUrlError);
  });
});

describe('User.reconstitute()', () => {
  it('reconstitutes all fields without validation', () => {
    const data = {
      id: 'some-uuid',
      clerkUserId: 'user_abc',
      email: 'test@example.com',
      displayName: 'Test User',
      bio: null,
      avatarUrl: null,
      accountStatus: AccountStatus.Active,
      onboardingCompleted: true,
      onboardingStep: null,
      roles: [Role.Backer],
      notificationPrefs: NotificationPreferences.defaults(),
      kycStatus: KycStatus.NotStarted,
      lastSeenAt: new Date('2026-01-01'),
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    };

    const user = User.reconstitute(data);
    expect(user.id).toBe('some-uuid');
    expect(user.clerkUserId).toBe('user_abc');
    expect(user.accountStatus).toBe(AccountStatus.Active);
    expect(user.roles).toEqual([Role.Backer]);
  });
});

describe('user.activate()', () => {
  it('sets status to Active and adds Backer role', () => {
    const user = baseUser();
    const activated = user.activate();
    expect(activated.accountStatus).toBe(AccountStatus.Active);
    expect(activated.roles).toContain(Role.Backer);
  });

  it('does not duplicate Backer role if already present', () => {
    const user = User.reconstitute({
      id: 'id1',
      clerkUserId: 'user_test',
      email: 'test@example.com',
      displayName: null,
      bio: null,
      avatarUrl: null,
      accountStatus: AccountStatus.PendingVerification,
      onboardingCompleted: false,
      onboardingStep: null,
      roles: [Role.Backer],
      notificationPrefs: NotificationPreferences.defaults(),
      kycStatus: KycStatus.NotStarted,
      lastSeenAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const activated = user.activate();
    expect(activated.roles.filter((r) => r === Role.Backer)).toHaveLength(1);
  });

  it('throws AlreadyActiveError if already Active', () => {
    const user = User.reconstitute({
      id: 'id1',
      clerkUserId: 'user_test',
      email: 'test@example.com',
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
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(() => user.activate()).toThrow(AlreadyActiveError);
  });
});

describe('user.assignRole()', () => {
  it('adds Creator role without removing existing Backer role', () => {
    const user = User.reconstitute({
      id: 'id1',
      clerkUserId: 'user_test',
      email: 'test@example.com',
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
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const updated = user.assignRole(Role.Creator);
    expect(updated.roles).toContain(Role.Backer);
    expect(updated.roles).toContain(Role.Creator);
  });

  it('is idempotent — no-op if role already assigned', () => {
    const user = User.reconstitute({
      id: 'id1',
      clerkUserId: 'user_test',
      email: 'test@example.com',
      displayName: null,
      bio: null,
      avatarUrl: null,
      accountStatus: AccountStatus.Active,
      onboardingCompleted: false,
      onboardingStep: null,
      roles: [Role.Backer, Role.Creator],
      notificationPrefs: NotificationPreferences.defaults(),
      kycStatus: KycStatus.NotStarted,
      lastSeenAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const updated = user.assignRole(Role.Creator);
    expect(updated.roles.filter((r) => r === Role.Creator)).toHaveLength(1);
  });

  it('throws SuperAdminAssignmentForbiddenError for SuperAdministrator', () => {
    const user = baseUser();
    expect(() => user.assignRole(Role.SuperAdministrator)).toThrow(
      SuperAdminAssignmentForbiddenError,
    );
  });
});

describe('user.removeRole()', () => {
  it('removes Creator role from a multi-role user', () => {
    const user = User.reconstitute({
      id: 'id1',
      clerkUserId: 'user_test',
      email: 'test@example.com',
      displayName: null,
      bio: null,
      avatarUrl: null,
      accountStatus: AccountStatus.Active,
      onboardingCompleted: false,
      onboardingStep: null,
      roles: [Role.Backer, Role.Creator],
      notificationPrefs: NotificationPreferences.defaults(),
      kycStatus: KycStatus.NotStarted,
      lastSeenAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const updated = user.removeRole(Role.Creator);
    expect(updated.roles).not.toContain(Role.Creator);
    expect(updated.roles).toContain(Role.Backer);
  });

  it('throws CannotRemoveBackerRoleError when Backer is the only role', () => {
    const user = User.reconstitute({
      id: 'id1',
      clerkUserId: 'user_test',
      email: 'test@example.com',
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
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(() => user.removeRole(Role.Backer)).toThrow(CannotRemoveBackerRoleError);
  });

  it('throws RoleNotAssignedError if user does not have the role', () => {
    const user = User.reconstitute({
      id: 'id1',
      clerkUserId: 'user_test',
      email: 'test@example.com',
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
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(() => user.removeRole(Role.Creator)).toThrow(RoleNotAssignedError);
  });
});

describe('user.updateProfile()', () => {
  it('updates all three fields', () => {
    const user = baseUser();
    const updated = user.updateProfile({
      displayName: 'Ada Lovelace',
      bio: 'Pioneer of computing',
      avatarUrl: 'https://example.com/ada.jpg',
    });
    expect(updated.displayName).toBe('Ada Lovelace');
    expect(updated.bio).toBe('Pioneer of computing');
    expect(updated.avatarUrl).toBe('https://example.com/ada.jpg');
  });

  it('treats empty string for displayName as null', () => {
    const user = User.reconstitute({
      id: 'id1',
      clerkUserId: 'user_test',
      email: 'test@example.com',
      displayName: 'Old Name',
      bio: null,
      avatarUrl: null,
      accountStatus: AccountStatus.Active,
      onboardingCompleted: false,
      onboardingStep: null,
      roles: [Role.Backer],
      notificationPrefs: NotificationPreferences.defaults(),
      kycStatus: KycStatus.NotStarted,
      lastSeenAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const updated = user.updateProfile({ displayName: '' });
    expect(updated.displayName).toBeNull();
  });

  it('treats empty string for bio as null', () => {
    const user = User.reconstitute({
      id: 'id1',
      clerkUserId: 'user_test',
      email: 'test@example.com',
      displayName: null,
      bio: 'Old bio',
      avatarUrl: null,
      accountStatus: AccountStatus.Active,
      onboardingCompleted: false,
      onboardingStep: null,
      roles: [Role.Backer],
      notificationPrefs: NotificationPreferences.defaults(),
      kycStatus: KycStatus.NotStarted,
      lastSeenAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const updated = user.updateProfile({ bio: '' });
    expect(updated.bio).toBeNull();
  });

  it('throws DisplayNameTooLongError for displayName > 255 chars', () => {
    const user = baseUser();
    expect(() => user.updateProfile({ displayName: 'a'.repeat(256) })).toThrow(
      DisplayNameTooLongError,
    );
  });
});

describe('user.updateNotificationPrefs()', () => {
  it('merges partial update correctly', () => {
    const user = baseUser();
    const updated = user.updateNotificationPrefs({ recommendations: false });
    expect(updated.notificationPrefs.recommendations).toBe(false);
    expect(updated.notificationPrefs.securityAlerts).toBe(true);
    expect(updated.notificationPrefs.campaignUpdates).toBe(true);
  });

  it('throws SecurityAlertsCannotBeDisabledError when securityAlerts is false', () => {
    const user = baseUser();
    // Cast to overcome TypeScript type guard — testing runtime validation
    expect(() => user.updateNotificationPrefs({ securityAlerts: false as never })).toThrow(
      SecurityAlertsCannotBeDisabledError,
    );
  });
});

describe('user.touchLastSeen()', () => {
  it('updates lastSeenAt to current time', () => {
    const user = baseUser();
    expect(user.lastSeenAt).toBeNull();
    const before = new Date();
    const updated = user.touchLastSeen();
    const after = new Date();
    expect(updated.lastSeenAt).not.toBeNull();
    expect(updated.lastSeenAt!.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(updated.lastSeenAt!.getTime()).toBeLessThanOrEqual(after.getTime());
  });
});




























