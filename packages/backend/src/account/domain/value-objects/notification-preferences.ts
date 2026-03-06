export interface NotificationPreferences {
  readonly campaign_updates: boolean;
  readonly milestone_completions: boolean;
  readonly contribution_confirmations: boolean;
  readonly new_recommendations: boolean;
  readonly platform_announcements: boolean;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  campaign_updates: true,
  milestone_completions: true,
  contribution_confirmations: true,
  new_recommendations: true,
  platform_announcements: false,
};

/** Merge stored prefs with defaults so missing keys always have a value. */
export function resolveNotificationPreferences(
  stored: Partial<NotificationPreferences>,
): NotificationPreferences {
  return { ...DEFAULT_NOTIFICATION_PREFERENCES, ...stored };
}
