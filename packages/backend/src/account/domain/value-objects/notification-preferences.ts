export interface NotificationPreferences {
  readonly campaignUpdates: boolean;
  readonly milestoneCompletions: boolean;
  readonly contributionConfirmations: boolean;
  readonly recommendations: boolean;
  readonly securityAlerts: true; // Always true — type system enforces this
  readonly platformAnnouncements: boolean;
}

export const NotificationPreferences = {
  defaults(): NotificationPreferences {
    return {
      campaignUpdates: true,
      milestoneCompletions: true,
      contributionConfirmations: true,
      recommendations: true,
      securityAlerts: true,
      platformAnnouncements: false,
    };
  },
};
