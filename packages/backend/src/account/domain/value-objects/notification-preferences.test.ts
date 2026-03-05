import { describe, expect, it } from 'vitest';
import { NotificationPreferences } from './notification-preferences.js';

describe('NotificationPreferences.defaults()', () => {
  it('returns the correct default values', () => {
    const defaults = NotificationPreferences.defaults();
    expect(defaults.campaignUpdates).toBe(true);
    expect(defaults.milestoneCompletions).toBe(true);
    expect(defaults.contributionConfirmations).toBe(true);
    expect(defaults.recommendations).toBe(true);
    expect(defaults.securityAlerts).toBe(true);
    expect(defaults.platformAnnouncements).toBe(false);
  });

  it('securityAlerts is always true', () => {
    const defaults = NotificationPreferences.defaults();
    // This is enforced by TypeScript type (literal true)
    expect(defaults.securityAlerts).toBe(true);
  });
});
