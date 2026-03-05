// Per P-001: no TypeScript enums — use as const object + union type
export const ContributionStatus = {
  PendingCapture: 'pending_capture',
  Captured: 'captured',
  Failed: 'failed',
} as const;

export type ContributionStatus = (typeof ContributionStatus)[keyof typeof ContributionStatus];

export const ACTIVE_STATUSES: readonly ContributionStatus[] = [
  ContributionStatus.PendingCapture,
  ContributionStatus.Captured,
] as const;
