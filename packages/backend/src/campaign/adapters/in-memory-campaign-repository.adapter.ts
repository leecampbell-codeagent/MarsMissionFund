import { Campaign, type UpdateCampaignInput } from '../domain/models/campaign.js';
import type { CampaignStatus } from '../domain/value-objects/campaign-status.js';
import {
  CampaignAlreadyClaimedError,
  CampaignNotFoundError,
} from '../domain/errors/campaign-errors.js';
import type {
  CampaignRepository,
  CampaignStatusUpdate,
  ListCampaignOptions,
} from '../ports/campaign-repository.port.js';

/**
 * In-memory implementation for tests.
 * Exposed `campaigns` map allows test assertions.
 */
export class InMemoryCampaignRepository implements CampaignRepository {
  readonly campaigns: Map<string, Campaign> = new Map();

  async save(campaign: Campaign): Promise<void> {
    this.campaigns.set(campaign.id, campaign);
  }

  async findById(id: string): Promise<Campaign | null> {
    return this.campaigns.get(id) ?? null;
  }

  async findByCreatorUserId(
    creatorUserId: string,
    options?: ListCampaignOptions,
  ): Promise<Campaign[]> {
    const all = Array.from(this.campaigns.values()).filter(
      (c) => c.creatorUserId === creatorUserId,
    );
    // Sort by createdAt DESC
    all.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? all.length;
    return all.slice(offset, offset + limit);
  }

  async findSubmittedOrderedBySubmittedAt(options?: ListCampaignOptions): Promise<Campaign[]> {
    const submitted = Array.from(this.campaigns.values()).filter(
      (c) => c.status === 'submitted',
    );
    // Sort by submittedAt ASC (FIFO)
    submitted.sort((a, b) => {
      const aTime = a.submittedAt?.getTime() ?? 0;
      const bTime = b.submittedAt?.getTime() ?? 0;
      return aTime - bTime;
    });

    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? submitted.length;
    return submitted.slice(offset, offset + limit);
  }

  async updateStatus(
    campaignId: string,
    fromStatus: CampaignStatus,
    toStatus: CampaignStatus,
    updates?: CampaignStatusUpdate,
  ): Promise<Campaign> {
    const existing = this.campaigns.get(campaignId);
    if (!existing) {
      throw new CampaignNotFoundError();
    }

    // Atomic conditional check (mirrors WHERE id = $1 AND status = $fromStatus)
    if (existing.status !== fromStatus) {
      throw new CampaignAlreadyClaimedError();
    }

    const updated = Campaign.reconstitute({
      id: existing.id,
      creatorUserId: existing.creatorUserId,
      title: existing.title,
      shortDescription: existing.shortDescription,
      description: existing.description,
      category: existing.category,
      heroImageUrl: existing.heroImageUrl,
      fundingGoalCents: existing.fundingGoalCents,
      fundingCapCents: existing.fundingCapCents,
      deadline: existing.deadline,
      milestones: existing.milestones,
      teamMembers: existing.teamMembers,
      riskDisclosures: existing.riskDisclosures,
      budgetBreakdown: existing.budgetBreakdown,
      alignmentStatement: existing.alignmentStatement,
      tags: existing.tags,
      status: toStatus,
      rejectionReason: updates?.rejectionReason !== undefined
        ? updates.rejectionReason
        : existing.rejectionReason,
      resubmissionGuidance: updates?.resubmissionGuidance !== undefined
        ? updates.resubmissionGuidance
        : existing.resubmissionGuidance,
      reviewNotes: updates?.reviewNotes !== undefined
        ? updates.reviewNotes
        : existing.reviewNotes,
      reviewedByUserId: updates?.reviewedByUserId !== undefined
        ? updates.reviewedByUserId
        : existing.reviewedByUserId,
      reviewedAt: updates?.reviewedAt !== undefined
        ? updates.reviewedAt
        : existing.reviewedAt,
      submittedAt: updates?.submittedAt !== undefined
        ? updates.submittedAt
        : existing.submittedAt,
      launchedAt: updates?.launchedAt !== undefined
        ? updates.launchedAt
        : existing.launchedAt,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    });

    this.campaigns.set(campaignId, updated);
    return updated;
  }

  async updateDraftFields(campaignId: string, input: UpdateCampaignInput): Promise<Campaign> {
    const existing = this.campaigns.get(campaignId);
    if (!existing) {
      throw new CampaignNotFoundError();
    }

    const updated = Campaign.reconstitute({
      id: existing.id,
      creatorUserId: existing.creatorUserId,
      title: input.title !== undefined ? input.title : existing.title,
      shortDescription:
        input.shortDescription !== undefined ? input.shortDescription : existing.shortDescription,
      description: input.description !== undefined ? input.description : existing.description,
      category: input.category !== undefined ? input.category : existing.category,
      heroImageUrl: input.heroImageUrl !== undefined ? input.heroImageUrl : existing.heroImageUrl,
      fundingGoalCents:
        input.fundingGoalCents !== undefined ? input.fundingGoalCents : existing.fundingGoalCents,
      fundingCapCents:
        input.fundingCapCents !== undefined ? input.fundingCapCents : existing.fundingCapCents,
      deadline: input.deadline !== undefined ? new Date(input.deadline) : existing.deadline,
      milestones: input.milestones !== undefined ? input.milestones : existing.milestones,
      teamMembers: input.teamMembers !== undefined ? input.teamMembers : existing.teamMembers,
      riskDisclosures:
        input.riskDisclosures !== undefined ? input.riskDisclosures : existing.riskDisclosures,
      budgetBreakdown:
        input.budgetBreakdown !== undefined ? input.budgetBreakdown : existing.budgetBreakdown,
      alignmentStatement:
        input.alignmentStatement !== undefined
          ? input.alignmentStatement
          : existing.alignmentStatement,
      tags: input.tags !== undefined ? input.tags : existing.tags,
      status: existing.status,
      rejectionReason: existing.rejectionReason,
      resubmissionGuidance: existing.resubmissionGuidance,
      reviewNotes: existing.reviewNotes,
      reviewedByUserId: existing.reviewedByUserId,
      reviewedAt: existing.reviewedAt,
      submittedAt: existing.submittedAt,
      launchedAt: existing.launchedAt,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    });

    this.campaigns.set(campaignId, updated);
    return updated;
  }
}
