export interface NotificationPreferencesResponse {
  readonly campaign_updates: boolean;
  readonly milestone_completions: boolean;
  readonly contribution_confirmations: boolean;
  readonly new_recommendations: boolean;
  readonly platform_announcements: boolean;
  readonly security_alerts: boolean; // always true from API
}

export interface MeData {
  readonly id: string;
  readonly clerkUserId: string;
  readonly email: string;
  readonly displayName: string | null;
  readonly bio: string | null;
  readonly avatarUrl: string | null;
  readonly accountStatus: string;
  readonly onboardingCompleted: boolean;
  readonly onboardingStep: number | null;
  readonly roles: string[];
  readonly notificationPreferences: NotificationPreferencesResponse;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface MeResponse {
  readonly data: MeData;
}
