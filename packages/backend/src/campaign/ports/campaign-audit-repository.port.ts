import type { CampaignStatus } from '../domain/value-objects/campaign-status.js';

export type CampaignAuditAction =
  | 'campaign.created'
  | 'campaign.updated'
  | 'campaign.submitted'
  | 'campaign.claimed'
  | 'campaign.approved'
  | 'campaign.rejected'
  | 'campaign.launched'
  | 'campaign.archived'
  | 'campaign.reassigned';

export interface CampaignAuditEvent {
  readonly id: string;
  readonly campaignId: string;
  readonly actorUserId: string | null;
  readonly actorClerkUserId: string;
  readonly action: CampaignAuditAction;
  readonly previousStatus: CampaignStatus | null;
  readonly newStatus: CampaignStatus;
  readonly rationale: string | null;
  readonly metadata: Record<string, unknown> | null;
  readonly createdAt: Date;
}

export interface CreateCampaignAuditEventInput {
  readonly campaignId: string;
  readonly actorUserId: string;
  readonly actorClerkUserId: string;
  readonly action: CampaignAuditAction;
  readonly previousStatus: CampaignStatus | null;
  readonly newStatus: CampaignStatus;
  readonly rationale?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface CampaignAuditRepository {
  createEvent(input: CreateCampaignAuditEventInput): Promise<CampaignAuditEvent>;
  findByCampaignId(campaignId: string): Promise<CampaignAuditEvent[]>;
}
