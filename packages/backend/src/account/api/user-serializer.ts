import type { User } from '../domain/models/user.js';

/**
 * Serialises a User domain entity to the API response shape.
 * Dates are serialised as ISO 8601 strings.
 */
export function serializeUser(user: User): object {
  return {
    id: user.id,
    clerkUserId: user.clerkUserId,
    email: user.email,
    displayName: user.displayName,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    accountStatus: user.accountStatus,
    roles: user.roles,
    kycStatus: user.kycStatus,
    onboardingCompleted: user.onboardingCompleted,
    onboardingStep: user.onboardingStep,
    notificationPrefs: user.notificationPrefs,
    lastSeenAt: user.lastSeenAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}






















