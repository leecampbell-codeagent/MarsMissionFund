import { describe, expect, it } from 'vitest';
import { MockUserRepository } from '../adapters/mock/mock-user-repository.js';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '../domain/value-objects/notification-preferences.js';
import { ProfileService } from './profile-service.js';

function makeService() {
  const repo = new MockUserRepository();
  const service = new ProfileService(repo);
  return { repo, service };
}

const TEST_USER_ID = '00000000-0000-0000-0000-000000000001';

describe('ProfileService.updateProfile()', () => {
  it('updates displayName and bio', async () => {
    const { service } = makeService();
    const user = await service.updateProfile(TEST_USER_ID, {
      displayName: 'Cosmonaut',
      bio: 'Heading to Mars',
    });
    expect(user.displayName).toBe('Cosmonaut');
    expect(user.bio).toBe('Heading to Mars');
  });

  it('clears displayName with null', async () => {
    const { service } = makeService();
    await service.updateProfile(TEST_USER_ID, { displayName: 'Initial' });
    const user = await service.updateProfile(TEST_USER_ID, { displayName: null });
    expect(user.displayName).toBeNull();
  });
});

describe('ProfileService.updateNotificationPreferences()', () => {
  it('updates preferences', async () => {
    const { service } = makeService();
    const prefs = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      campaign_updates: false,
      platform_announcements: true,
    };
    const user = await service.updateNotificationPreferences(TEST_USER_ID, prefs);
    expect(user.notificationPreferences.campaign_updates).toBe(false);
    expect(user.notificationPreferences.platform_announcements).toBe(true);
  });
});

describe('ProfileService.completeOnboarding()', () => {
  it('marks onboarding complete and adds roles', async () => {
    const { service } = makeService();
    const user = await service.completeOnboarding(TEST_USER_ID, {
      step: 3,
      roles: ['backer', 'creator'],
      displayName: 'Mars Funder',
    });
    expect(user.onboardingCompleted).toBe(true);
    expect(user.onboardingStep).toBe(3);
    expect(user.roles).toContain('creator');
    expect(user.displayName).toBe('Mars Funder');
  });
});

describe('ProfileService.saveOnboardingStep()', () => {
  it('saves step without setting onboardingCompleted', async () => {
    const { service, repo } = makeService();
    await service.saveOnboardingStep(TEST_USER_ID, 2);
    const user = await repo.findById(TEST_USER_ID);
    expect(user?.onboardingStep).toBe(2);
    expect(user?.onboardingCompleted).toBe(false);
  });
});
