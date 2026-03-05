/**
 * Account API functions for feat-004 onboarding and settings.
 * All requests go through the injected ApiClient from useApiClient().
 */

export type AccountRole = 'backer' | 'creator';

export type OnboardingStep = 'welcome' | 'role_selection' | 'profile' | 'preferences' | 'completed';

export interface NotificationPreferences {
  readonly campaign_updates: boolean;
  readonly milestone_completions: boolean;
  readonly contribution_confirmations: boolean;
  readonly new_campaign_recommendations: boolean;
  readonly security_alerts: boolean;
  readonly platform_announcements: boolean;
}

export interface Account {
  readonly id: string;
  readonly email: string;
  readonly display_name: string | null;
  readonly bio: string | null;
  readonly avatar_url: string | null;
  readonly status: string;
  readonly roles: readonly AccountRole[];
  readonly onboarding_completed: boolean;
  readonly onboarding_step: OnboardingStep;
  readonly notification_preferences: NotificationPreferences;
}

export interface UpdateProfileInput {
  readonly display_name?: string | null;
  readonly bio?: string | null;
  readonly avatar_url?: string | null;
}

export interface AdvanceOnboardingInput {
  readonly step: Exclude<OnboardingStep, 'welcome'>;
  readonly roles?: readonly AccountRole[];
}

export interface UpdatePreferencesInput {
  readonly campaign_updates: boolean;
  readonly milestone_completions: boolean;
  readonly contribution_confirmations: boolean;
  readonly new_campaign_recommendations: boolean;
  readonly security_alerts: boolean;
  readonly platform_announcements: boolean;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  campaign_updates: true,
  milestone_completions: true,
  contribution_confirmations: true,
  new_campaign_recommendations: true,
  security_alerts: true,
  platform_announcements: false,
};
