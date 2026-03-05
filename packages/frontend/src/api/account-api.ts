/**
 * Account API functions — typed wrappers around the API client.
 * Maps to endpoints defined in feat-001-spec-api.md.
 */

import { apiClient } from './client';

export interface NotificationPrefs {
  readonly campaignUpdates: boolean;
  readonly milestoneCompletions: boolean;
  readonly contributionConfirmations: boolean;
  readonly recommendations: boolean;
  readonly securityAlerts: boolean;
  readonly platformAnnouncements: boolean;
}

export interface UserProfile {
  readonly id: string;
  readonly clerkUserId: string;
  readonly email: string;
  readonly displayName: string | null;
  readonly bio: string | null;
  readonly avatarUrl: string | null;
  readonly accountStatus: 'pending_verification' | 'active' | 'suspended' | 'deactivated';
  readonly roles: ReadonlyArray<'backer' | 'creator' | 'reviewer' | 'administrator' | 'super_administrator'>;
  readonly kycStatus: 'not_started' | 'pending' | 'in_review' | 'verified' | 'rejected' | 'expired';
  readonly onboardingCompleted: boolean;
  readonly onboardingStep: string | null;
  readonly notificationPrefs: NotificationPrefs;
  readonly lastSeenAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

interface SyncUserResponse {
  readonly data: UserProfile;
}

interface GetMeResponse {
  readonly data: UserProfile;
}

interface UpdateProfileInput {
  readonly displayName?: string | null;
  readonly bio?: string | null;
  readonly avatarUrl?: string | null;
}

interface UpdateProfileResponse {
  readonly data: UserProfile;
}

interface GetNotificationPrefsResponse {
  readonly data: NotificationPrefs;
}

interface UpdateNotificationPrefsInput {
  readonly campaignUpdates?: boolean;
  readonly milestoneCompletions?: boolean;
  readonly contributionConfirmations?: boolean;
  readonly recommendations?: boolean;
  readonly platformAnnouncements?: boolean;
}

interface UpdateNotificationPrefsResponse {
  readonly data: NotificationPrefs;
}

/**
 * POST /api/v1/auth/sync
 * Creates or updates the MMF user record after Clerk sign-in.
 */
export async function syncUser(): Promise<UserProfile> {
  const response = await apiClient<SyncUserResponse>({
    method: 'POST',
    path: '/auth/sync',
  });
  return response.data;
}

/**
 * GET /api/v1/me
 * Returns the current authenticated user's profile.
 */
export async function getCurrentUser(): Promise<UserProfile> {
  const response = await apiClient<GetMeResponse>({
    method: 'GET',
    path: '/me',
  });
  return response.data;
}

/**
 * PATCH /api/v1/me/profile
 * Updates the current user's profile fields.
 */
export async function updateProfile(input: UpdateProfileInput): Promise<UserProfile> {
  const response = await apiClient<UpdateProfileResponse>({
    method: 'PATCH',
    path: '/me/profile',
    body: input,
  });
  return response.data;
}

/**
 * GET /api/v1/me/notifications
 * Returns the current user's notification preferences.
 */
export async function getNotificationPrefs(): Promise<NotificationPrefs> {
  const response = await apiClient<GetNotificationPrefsResponse>({
    method: 'GET',
    path: '/me/notifications',
  });
  return response.data;
}

/**
 * PATCH /api/v1/me/notifications
 * Updates a subset of the current user's notification preferences.
 * Security alerts cannot be disabled (server enforces this).
 */
export async function updateNotificationPrefs(
  input: UpdateNotificationPrefsInput,
): Promise<NotificationPrefs> {
  const response = await apiClient<UpdateNotificationPrefsResponse>({
    method: 'PATCH',
    path: '/me/notifications',
    body: input,
  });
  return response.data;
}

interface CompleteOnboardingResponse {
  readonly data: UserProfile;
}

/**
 * POST /api/v1/me/onboarding/complete
 * Marks the current user's onboarding as complete.
 * This is the only way to set onboardingCompleted — it cannot be set via PATCH /me/profile (HIGH-003).
 */
export async function completeOnboarding(): Promise<UserProfile> {
  const response = await apiClient<CompleteOnboardingResponse>({
    method: 'POST',
    path: '/me/onboarding/complete',
  });
  return response.data;
}



















