export const CampaignStatus = {
  Draft: 'draft',
  Submitted: 'submitted',
  UnderReview: 'under_review',
  Approved: 'approved',
  Rejected: 'rejected',
  Live: 'live',
  Funded: 'funded',
  Suspended: 'suspended',
  Failed: 'failed',
  Settlement: 'settlement',
  Complete: 'complete',
  Cancelled: 'cancelled',
  Archived: 'archived',
} as const;

export type CampaignStatus = (typeof CampaignStatus)[keyof typeof CampaignStatus];

/** States that are editable via PATCH (auto-save) */
export const EDITABLE_STATUSES: readonly CampaignStatus[] = [
  CampaignStatus.Draft,
  CampaignStatus.Rejected,
] as const;

/** States from which a creator can submit */
export const SUBMITTABLE_STATUSES: readonly CampaignStatus[] = [
  CampaignStatus.Draft,
  CampaignStatus.Rejected,
] as const;

/** States from which a creator can self-archive */
export const CREATOR_ARCHIVABLE_STATUSES: readonly CampaignStatus[] = [
  CampaignStatus.Draft,
  CampaignStatus.Rejected,
] as const;
