import type {
  CategoryStats,
  PublicCampaignDetail,
  PublicSearchOptions,
  PublicSearchResult,
} from '../application/campaign-app-service.js';
import type { Campaign, UpdateCampaignInput } from '../domain/models/campaign.js';
import type { CampaignCategory } from '../domain/value-objects/campaign-category.js';
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

  /**
   * Full-text search with filters, sort, and pagination.
   * Returns only campaigns with status IN ('live', 'funded').
   * Joins users table for creatorName.
   */
  searchPublicCampaigns(options: PublicSearchOptions): Promise<PublicSearchResult>;

  /**
   * Returns a single public campaign by ID.
   * Returns null if the campaign does not exist OR if its status is not 'live' or 'funded'.
   */
  findPublicById(id: string): Promise<PublicCampaignDetail | null>;

  /**
   * Aggregate stats for a single category.
   */
  getCategoryStats(category: CampaignCategory): Promise<CategoryStats>;
}
