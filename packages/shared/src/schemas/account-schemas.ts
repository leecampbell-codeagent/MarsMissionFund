import { z } from 'zod';

// Value type constants (as const + union type instead of enums - WARN-001)
export const AccountStatusValues = {
  PendingVerification: 'pending_verification',
  Active: 'active',
  Suspended: 'suspended',
  Deactivated: 'deactivated',
} as const;

export type AccountStatus = (typeof AccountStatusValues)[keyof typeof AccountStatusValues];

export const RoleValues = {
  Backer: 'backer',
  Creator: 'creator',
  Reviewer: 'reviewer',
  Administrator: 'administrator',
  SuperAdministrator: 'super_administrator',
} as const;

export type Role = (typeof RoleValues)[keyof typeof RoleValues];

export const KycStatusValues = {
  NotStarted: 'not_started',
  Pending: 'pending',
  InReview: 'in_review',
  Verified: 'verified',
  Failed: 'failed',
  Expired: 'expired',
} as const;

export type KycStatus = (typeof KycStatusValues)[keyof typeof KycStatusValues];

export const OnboardingStepValues = {
  RoleSelection: 'role_selection',
  Profiling: 'profiling',
  Notifications: 'notifications',
  Complete: 'complete',
} as const;

export type OnboardingStep = (typeof OnboardingStepValues)[keyof typeof OnboardingStepValues];

// Notification preferences schema
export const notificationPrefsSchema = z.object({
  campaignUpdates: z.boolean(),
  milestoneCompletions: z.boolean(),
  contributionConfirmations: z.boolean(),
  recommendations: z.boolean(),
  securityAlerts: z.literal(true),
  platformAnnouncements: z.boolean(),
});

export type NotificationPrefs = z.infer<typeof notificationPrefsSchema>;

// Sync user schema (POST /api/v1/auth/sync — body is empty)
export const syncUserSchema = z.object({}).strict();

export type SyncUserInput = z.infer<typeof syncUserSchema>;

// Update profile schema (PATCH /api/v1/me/profile) — onboardingCompleted and onboardingStep removed (HIGH-003)
export const updateProfileSchema = z
  .object({
    displayName: z
      .string()
      .max(255)
      .nullable()
      .optional()
      .transform((v) => (v === '' ? null : v)),
    bio: z
      .string()
      .max(500)
      .nullable()
      .optional()
      .transform((v) => (v === '' ? null : v)),
    avatarUrl: z.string().url().nullable().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// Update notifications schema (PATCH /api/v1/me/notifications)
// securityAlerts is NOT accepted — .strict() rejects it
export const updateNotificationsSchema = z
  .object({
    campaignUpdates: z.boolean().optional(),
    milestoneCompletions: z.boolean().optional(),
    contributionConfirmations: z.boolean().optional(),
    recommendations: z.boolean().optional(),
    platformAnnouncements: z.boolean().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export type UpdateNotificationsInput = z.infer<typeof updateNotificationsSchema>;

// User profile response shape (shared between frontend and backend)
export const userProfileSchema = z.object({
  id: z.string().uuid(),
  clerkUserId: z.string(),
  email: z.string().email(),
  displayName: z.string().nullable(),
  bio: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  accountStatus: z.enum(['pending_verification', 'active', 'suspended', 'deactivated']),
  roles: z.array(z.enum(['backer', 'creator', 'reviewer', 'administrator', 'super_administrator'])),
  kycStatus: z.enum(['not_started', 'pending', 'in_review', 'verified', 'failed', 'expired']),
  onboardingCompleted: z.boolean(),
  onboardingStep: z.enum(['role_selection', 'profiling', 'notifications', 'complete']).nullable(),
  notificationPrefs: notificationPrefsSchema,
  lastSeenAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type UserProfile = z.infer<typeof userProfileSchema>;






















