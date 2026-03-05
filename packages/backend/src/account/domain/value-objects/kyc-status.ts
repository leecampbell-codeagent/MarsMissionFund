// WARN-001: use as const + union types instead of TypeScript enums
export const KycStatus = {
  NotStarted: 'not_started',
  Pending: 'pending',
  InReview: 'in_review',
  Verified: 'verified',
  Rejected: 'rejected', // was 'Failed: failed' — renamed per G-018
  Expired: 'expired',
} as const;

export type KycStatus = (typeof KycStatus)[keyof typeof KycStatus];




























