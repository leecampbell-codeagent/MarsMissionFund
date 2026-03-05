// WARN-001: use as const + union types instead of TypeScript enums
export const KycStatus = {
  NotStarted: 'not_started',
  Pending: 'pending',
  InReview: 'in_review',
  Verified: 'verified',
  Failed: 'failed',
  Expired: 'expired',
} as const;

export type KycStatus = (typeof KycStatus)[keyof typeof KycStatus];




























