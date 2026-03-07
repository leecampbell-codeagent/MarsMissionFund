export const KycStatus = {
  NotVerified: 'not_verified',
  Pending: 'pending',
  InReview: 'in_review',
  Verified: 'verified',
  Failed: 'failed',
  Expired: 'expired',
} as const;

export type KycStatus = (typeof KycStatus)[keyof typeof KycStatus];
