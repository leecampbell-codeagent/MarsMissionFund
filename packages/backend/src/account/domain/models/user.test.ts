import { describe, expect, it } from 'vitest';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '../value-objects/notification-preferences.js';
import { User } from './user.js';

function makeBaseData() {
  return {
    id: 'test-id-001',
    clerkUserId: 'user_test',
    email: 'user@test.com',
    displayName: null,
    avatarUrl: null,
    bio: null,
    accountStatus: 'active' as const,
    onboardingCompleted: false,
    onboardingStep: null,
    notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  };
}

describe('User.reconstitute()', () => {
  it('returns correct id and clerkUserId', () => {
    const user = User.reconstitute(makeBaseData(), ['backer']);
    expect(user.id).toBe('test-id-001');
    expect(user.clerkUserId).toBe('user_test');
  });

  it('returns bio: null when null', () => {
    const user = User.reconstitute(makeBaseData(), []);
    expect(user.bio).toBeNull();
  });

  it('returns bio string when set', () => {
    const data = { ...makeBaseData(), bio: 'Mars enthusiast' };
    const user = User.reconstitute(data, []);
    expect(user.bio).toBe('Mars enthusiast');
  });

  it('returns onboardingStep: null when null', () => {
    const user = User.reconstitute(makeBaseData(), []);
    expect(user.onboardingStep).toBeNull();
  });

  it('returns onboardingStep number when set', () => {
    const data = { ...makeBaseData(), onboardingStep: 2 };
    const user = User.reconstitute(data, []);
    expect(user.onboardingStep).toBe(2);
  });

  it('returns notificationPreferences unchanged', () => {
    const user = User.reconstitute(makeBaseData(), []);
    expect(user.notificationPreferences).toEqual(DEFAULT_NOTIFICATION_PREFERENCES);
  });

  it('returns roles array', () => {
    const user = User.reconstitute(makeBaseData(), ['backer', 'creator']);
    expect(user.roles).toEqual(['backer', 'creator']);
  });

  it('returns onboardingCompleted', () => {
    const data = { ...makeBaseData(), onboardingCompleted: true };
    const user = User.reconstitute(data, []);
    expect(user.onboardingCompleted).toBe(true);
  });
});
