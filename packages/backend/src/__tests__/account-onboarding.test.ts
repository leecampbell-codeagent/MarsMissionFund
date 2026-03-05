import { describe, expect, it } from 'vitest';
import {
  Account,
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferences,
} from '../account/domain/account.js';
import { ACCOUNT_EVENT_TYPES } from '../account/domain/account-events.js';
import {
  AccountNotFoundError,
  DomainError,
  InvalidAccountDataError,
  InvalidOnboardingStepError,
} from '../shared/domain/errors.js';


// ─── Helper ──────────────────────────────────────────────────────────────────

function makeAccount(overrides: Partial<Parameters<typeof Account.reconstitute>[0]> = {}): Account {
  return Account.reconstitute({
    id: 'acc-001',
    clerkUserId: 'user_abc',
    email: 'pioneer@marsmission.fund',
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

// ─── Account.create() defaults ───────────────────────────────────────────────

describe('Account.create() — new onboarding fields', () => {
  it('sets onboardingStep to welcome by default', () => {
    const account = Account.create({
      clerkUserId: 'user_001',
      email: 'pioneer@marsmission.fund',
    });
    expect(account.onboardingStep).toBe('welcome');
  });

  it('sets onboardingCompleted to false by default', () => {
    const account = Account.create({
      clerkUserId: 'user_001',
      email: 'pioneer@marsmission.fund',
    });
    expect(account.onboardingCompleted).toBe(false);
  });

  it('sets bio to null by default', () => {
    const account = Account.create({
      clerkUserId: 'user_001',
      email: 'pioneer@marsmission.fund',
    });
    expect(account.bio).toBeNull();
  });

  it('sets avatarUrl to null by default', () => {
    const account = Account.create({
      clerkUserId: 'user_001',
      email: 'pioneer@marsmission.fund',
    });
    expect(account.avatarUrl).toBeNull();
  });

  it('sets default notification preferences', () => {
    const account = Account.create({
      clerkUserId: 'user_001',
      email: 'pioneer@marsmission.fund',
    });
    expect(account.notificationPreferences).toEqual(DEFAULT_NOTIFICATION_PREFERENCES);
    expect(account.notificationPreferences.campaign_updates).toBe(true);
    expect(account.notificationPreferences.security_alerts).toBe(true);
    expect(account.notificationPreferences.platform_announcements).toBe(false);
  });
});

// ─── withProfile() ───────────────────────────────────────────────────────────

describe('Account.withProfile()', () => {
  it('updates display name, bio, and avatar URL', () => {
    const account = makeAccount();
    const updated = account.withProfile('Jane Pioneer', 'Mars enthusiast', 'https://example.com/avatar.jpg');

    expect(updated.displayName).toBe('Jane Pioneer');
    expect(updated.bio).toBe('Mars enthusiast');
    expect(updated.avatarUrl).toBe('https://example.com/avatar.jpg');
  });

  it('trims whitespace from display name', () => {
    const account = makeAccount();
    const updated = account.withProfile('  Jane  ', null, null);
    expect(updated.displayName).toBe('Jane');
  });

  it('trims whitespace from bio', () => {
    const account = makeAccount();
    const updated = account.withProfile(null, '  Mars enthusiast  ', null);
    expect(updated.bio).toBe('Mars enthusiast');
  });

  it('accepts null values (clearing fields)', () => {
    const account = makeAccount({ displayName: 'Jane', bio: 'Bio', avatarUrl: 'https://example.com/a.jpg' });
    const updated = account.withProfile(null, null, null);

    expect(updated.displayName).toBeNull();
    expect(updated.bio).toBeNull();
    expect(updated.avatarUrl).toBeNull();
  });

  it('returns a new Account instance (original unchanged)', () => {
    const account = makeAccount();
    const updated = account.withProfile('Jane', null, null);

    expect(updated).not.toBe(account);
    expect(account.displayName).toBeNull();
    expect(updated.displayName).toBe('Jane');
  });

  it('rejects whitespace-only display name', () => {
    const account = makeAccount();
    expect(() => account.withProfile('   ', null, null)).toThrow(InvalidAccountDataError);
  });

  it('rejects display name over 100 characters', () => {
    const account = makeAccount();
    const longName = 'a'.repeat(101);
    expect(() => account.withProfile(longName, null, null)).toThrow(InvalidAccountDataError);
  });

  it('rejects display name of exactly 101 chars', () => {
    const account = makeAccount();
    expect(() => account.withProfile('a'.repeat(101), null, null)).toThrow(InvalidAccountDataError);
  });

  it('accepts display name of exactly 100 chars', () => {
    const account = makeAccount();
    const updated = account.withProfile('a'.repeat(100), null, null);
    expect(updated.displayName).toBe('a'.repeat(100));
  });

  it('rejects bio over 500 characters', () => {
    const account = makeAccount();
    expect(() => account.withProfile(null, 'a'.repeat(501), null)).toThrow(InvalidAccountDataError);
  });

  it('accepts bio of exactly 500 chars', () => {
    const account = makeAccount();
    const updated = account.withProfile(null, 'a'.repeat(500), null);
    expect(updated.bio).toBe('a'.repeat(500));
  });

  it('rejects avatar URL without https', () => {
    const account = makeAccount();
    expect(() => account.withProfile(null, null, 'http://example.com/avatar.jpg')).toThrow(InvalidAccountDataError);
  });

  it('accepts avatar URL with https', () => {
    const account = makeAccount();
    const updated = account.withProfile(null, null, 'https://example.com/avatar.jpg');
    expect(updated.avatarUrl).toBe('https://example.com/avatar.jpg');
  });

  it('InvalidAccountDataError has correct code', () => {
    const account = makeAccount();
    try {
      account.withProfile('   ', null, null);
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidAccountDataError);
      expect((error as DomainError).code).toBe('INVALID_ACCOUNT_DATA');
    }
  });

  it('only updates provided fields (undefined leaves existing unchanged)', () => {
    const account = makeAccount({ displayName: 'Existing Name', bio: 'Existing Bio' });
    const updated = account.withProfile(undefined, undefined, undefined);

    expect(updated.displayName).toBe('Existing Name');
    expect(updated.bio).toBe('Existing Bio');
  });
});

// ─── withRoles() ─────────────────────────────────────────────────────────────

describe('Account.withRoles()', () => {
  it('updates roles array', () => {
    const account = makeAccount();
    const updated = account.withRoles(['backer', 'creator']);
    expect(updated.roles).toEqual(['backer', 'creator']);
  });

  it('returns a new Account instance', () => {
    const account = makeAccount();
    const updated = account.withRoles(['backer', 'creator']);
    expect(updated).not.toBe(account);
    expect(account.roles).toEqual(['backer']);
  });

  it('rejects empty roles array', () => {
    const account = makeAccount();
    expect(() => account.withRoles([])).toThrow(InvalidAccountDataError);
  });

  it('requires backer role to always be present', () => {
    const account = makeAccount();
    expect(() => account.withRoles(['creator'])).toThrow(InvalidAccountDataError);
  });

  it('rejects invalid role values', () => {
    const account = makeAccount();
    expect(() => account.withRoles(['backer', 'invalid_role' as never])).toThrow(InvalidAccountDataError);
  });

  it('accepts all valid role values', () => {
    const account = makeAccount();
    const updated = account.withRoles(['backer', 'creator', 'reviewer', 'administrator', 'super_administrator']);
    expect(updated.roles).toEqual(['backer', 'creator', 'reviewer', 'administrator', 'super_administrator']);
  });
});

// ─── withOnboardingStep() ────────────────────────────────────────────────────

describe('Account.withOnboardingStep()', () => {
  it('advances from welcome to role_selection', () => {
    const account = makeAccount({ onboardingStep: 'welcome' });
    const updated = account.withOnboardingStep('role_selection');
    expect(updated.onboardingStep).toBe('role_selection');
  });

  it('advances through all steps in order', () => {
    let account = makeAccount({ onboardingStep: 'welcome' });
    account = account.withOnboardingStep('role_selection');
    expect(account.onboardingStep).toBe('role_selection');

    account = account.withOnboardingStep('profile');
    expect(account.onboardingStep).toBe('profile');

    account = account.withOnboardingStep('preferences');
    expect(account.onboardingStep).toBe('preferences');

    account = account.withOnboardingStep('completed');
    expect(account.onboardingStep).toBe('completed');
  });

  it('sets onboardingCompleted to true when step is completed', () => {
    const account = makeAccount({ onboardingStep: 'preferences' });
    const updated = account.withOnboardingStep('completed');
    expect(updated.onboardingCompleted).toBe(true);
  });

  it('does not set onboardingCompleted for intermediate steps', () => {
    const account = makeAccount({ onboardingStep: 'welcome' });
    const updated = account.withOnboardingStep('role_selection');
    expect(updated.onboardingCompleted).toBe(false);
  });

  it('rejects step regression (profile -> welcome)', () => {
    const account = makeAccount({ onboardingStep: 'profile' });
    expect(() => account.withOnboardingStep('welcome')).toThrow(InvalidOnboardingStepError);
  });

  it('rejects step regression (preferences -> role_selection)', () => {
    const account = makeAccount({ onboardingStep: 'preferences' });
    expect(() => account.withOnboardingStep('role_selection')).toThrow(InvalidOnboardingStepError);
  });

  it('rejects same step (no-op regression)', () => {
    const account = makeAccount({ onboardingStep: 'role_selection' });
    expect(() => account.withOnboardingStep('role_selection')).toThrow(InvalidOnboardingStepError);
  });

  it('rejects invalid step value', () => {
    const account = makeAccount({ onboardingStep: 'welcome' });
    expect(() => account.withOnboardingStep('invalid_step' as never)).toThrow(InvalidOnboardingStepError);
  });

  it('returns a new Account instance', () => {
    const account = makeAccount({ onboardingStep: 'welcome' });
    const updated = account.withOnboardingStep('role_selection');
    expect(updated).not.toBe(account);
    expect(account.onboardingStep).toBe('welcome');
  });

  it('InvalidOnboardingStepError has correct code', () => {
    const account = makeAccount({ onboardingStep: 'profile' });
    try {
      account.withOnboardingStep('welcome');
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidOnboardingStepError);
      expect((error as DomainError).code).toBe('INVALID_ONBOARDING_STEP');
    }
  });

  it('allows skipping steps (e.g. welcome -> profile)', () => {
    const account = makeAccount({ onboardingStep: 'welcome' });
    const updated = account.withOnboardingStep('profile');
    expect(updated.onboardingStep).toBe('profile');
  });
});

// ─── withNotificationPreferences() ──────────────────────────────────────────

describe('Account.withNotificationPreferences()', () => {
  it('updates all notification preferences', () => {
    const account = makeAccount();
    const prefs: NotificationPreferences = {
      campaign_updates: false,
      milestone_completions: false,
      contribution_confirmations: false,
      new_campaign_recommendations: false,
      security_alerts: false, // will be forced to true
      platform_announcements: true,
    };
    const updated = account.withNotificationPreferences(prefs);

    expect(updated.notificationPreferences.campaign_updates).toBe(false);
    expect(updated.notificationPreferences.milestone_completions).toBe(false);
    expect(updated.notificationPreferences.contribution_confirmations).toBe(false);
    expect(updated.notificationPreferences.new_campaign_recommendations).toBe(false);
    expect(updated.notificationPreferences.platform_announcements).toBe(true);
  });

  it('forces security_alerts to true even if false is provided', () => {
    const account = makeAccount();
    const prefs: NotificationPreferences = {
      campaign_updates: true,
      milestone_completions: true,
      contribution_confirmations: true,
      new_campaign_recommendations: true,
      security_alerts: false,
      platform_announcements: false,
    };
    const updated = account.withNotificationPreferences(prefs);
    expect(updated.notificationPreferences.security_alerts).toBe(true);
  });

  it('returns a new Account instance', () => {
    const account = makeAccount();
    const prefs = { ...DEFAULT_NOTIFICATION_PREFERENCES, campaign_updates: false };
    const updated = account.withNotificationPreferences(prefs);
    expect(updated).not.toBe(account);
    expect(account.notificationPreferences.campaign_updates).toBe(true);
  });
});

// ─── withDisplayNameFromWebhook() ────────────────────────────────────────────

describe('Account.withDisplayNameFromWebhook()', () => {
  it('sets display name when current is null', () => {
    const account = makeAccount({ displayName: null });
    const updated = account.withDisplayNameFromWebhook('Webhook Name');
    expect(updated.displayName).toBe('Webhook Name');
  });

  it('does not overwrite existing display name', () => {
    const account = makeAccount({ displayName: 'Existing Name' });
    const updated = account.withDisplayNameFromWebhook('Webhook Name');
    expect(updated.displayName).toBe('Existing Name');
  });

  it('returns same instance (or at least same values) when display name already set', () => {
    const account = makeAccount({ displayName: 'Existing Name' });
    const updated = account.withDisplayNameFromWebhook('Webhook Name');
    expect(updated.displayName).toBe('Existing Name');
  });

  it('accepts null from webhook when display name is null', () => {
    const account = makeAccount({ displayName: null });
    const updated = account.withDisplayNameFromWebhook(null);
    expect(updated.displayName).toBeNull();
  });
});

// ─── Domain Errors ────────────────────────────────────────────────────────────

describe('Domain errors — new types', () => {
  it('InvalidOnboardingStepError has code INVALID_ONBOARDING_STEP', () => {
    const error = new InvalidOnboardingStepError('Cannot regress');
    expect(error.code).toBe('INVALID_ONBOARDING_STEP');
    expect(error.name).toBe('InvalidOnboardingStepError');
    expect(error).toBeInstanceOf(DomainError);
  });

  it('AccountNotFoundError has code ACCOUNT_NOT_FOUND', () => {
    const error = new AccountNotFoundError();
    expect(error.code).toBe('ACCOUNT_NOT_FOUND');
    expect(error.message).toBe('Account not found.');
    expect(error.name).toBe('AccountNotFoundError');
    expect(error).toBeInstanceOf(DomainError);
  });

  it('AccountNotFoundError accepts custom message', () => {
    const error = new AccountNotFoundError('Custom message');
    expect(error.message).toBe('Custom message');
  });
});

// ─── Account Event Types ──────────────────────────────────────────────────────

describe('ACCOUNT_EVENT_TYPES', () => {
  it('has correct string values', () => {
    expect(ACCOUNT_EVENT_TYPES.PROFILE_UPDATED).toBe('account.profile_updated');
    expect(ACCOUNT_EVENT_TYPES.ROLES_UPDATED).toBe('account.roles_updated');
    expect(ACCOUNT_EVENT_TYPES.ONBOARDING_STEP_COMPLETED).toBe('account.onboarding_step_completed');
    expect(ACCOUNT_EVENT_TYPES.ONBOARDING_COMPLETED).toBe('account.onboarding_completed');
    expect(ACCOUNT_EVENT_TYPES.PREFERENCES_UPDATED).toBe('account.preferences_updated');
  });
});
