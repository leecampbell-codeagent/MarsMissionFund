import type { Campaign, UpdateCampaignInput } from '../domain/models/campaign.js';
import type { CampaignStatus } from '../domain/value-objects/campaign-status.js';

export interface ListCampaignOptions {
  readonly limit?: number;
  readonly offset?: number;
}

export interface CampaignStatusUpdate {
  readonly reviewedByUserId?: string | null;
  readonly reviewNotes?: string | null;
  readonly rejectionReason?: string | null;
  readonly resubmissionGuidance?: string | null;
  readonly reviewedAt?: Date | null;
  readonly submittedAt?: Date | null;
  readonly launchedAt?: Date | null;
}

export interface CampaignRepository {
  save(campaign: Campaign): Promise<void>;
  findById(id: string): Promise<Campaign | null>;
  findByCreatorUserId(creatorUserId: string, options?: ListCampaignOptions): Promise<Campaign[]>;
  findSubmittedOrderedBySubmittedAt(options?: ListCampaignOptions): Promise<Campaign[]>;
  updateStatus(
    campaignId: string,
    fromStatus: CampaignStatus,
    toStatus: CampaignStatus,
    updates?: CampaignStatusUpdate,
  ): Promise<Campaign>;
  updateDraftFields(campaignId: string, input: UpdateCampaignInput): Promise<Campaign>;
}
