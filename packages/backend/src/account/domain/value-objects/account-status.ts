// WARN-001: use as const + union types instead of TypeScript enums
export const AccountStatus = {
  PendingVerification: 'pending_verification',
  Active: 'active',
  Suspended: 'suspended',
  Deactivated: 'deactivated',
} as const;

export type AccountStatus = (typeof AccountStatus)[keyof typeof AccountStatus];




























