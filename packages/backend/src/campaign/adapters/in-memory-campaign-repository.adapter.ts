import type {
  CategoryStats,
  PublicCampaignDetail,
  PublicSearchOptions,
  PublicSearchResult,
} from '../application/campaign-app-service.js';
import {
  CampaignAlreadyClaimedError,
  CampaignNotFoundError,
} from '../domain/errors/campaign-errors.js';
import { Campaign, type UpdateCampaignInput } from '../domain/models/campaign.js';
import type { CampaignCategory } from '../domain/value-objects/campaign-category.js';
import type { CampaignStatus } from '../domain/value-objects/campaign-status.js';
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
    const submitted = Array.from(this.campaigns.values()).filter((c) => c.status === 'submitted');
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
      rejectionReason:
        updates?.rejectionReason !== undefined ? updates.rejectionReason : existing.rejectionReason,
      resubmissionGuidance:
        updates?.resubmissionGuidance !== undefined
          ? updates.resubmissionGuidance
          : existing.resubmissionGuidance,
      reviewNotes: updates?.reviewNotes !== undefined ? updates.reviewNotes : existing.reviewNotes,
      reviewedByUserId:
        updates?.reviewedByUserId !== undefined
          ? updates.reviewedByUserId
          : existing.reviewedByUserId,
      reviewedAt: updates?.reviewedAt !== undefined ? updates.reviewedAt : existing.reviewedAt,
      submittedAt: updates?.submittedAt !== undefined ? updates.submittedAt : existing.submittedAt,
      launchedAt: updates?.launchedAt !== undefined ? updates.launchedAt : existing.launchedAt,
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

  async searchPublicCampaigns(options: PublicSearchOptions): Promise<PublicSearchResult> {
    const PUBLIC_STATUSES = ['live', 'funded'];
    const now = new Date();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    let results = Array.from(this.campaigns.values()).filter((c) =>
      PUBLIC_STATUSES.includes(c.status),
    );

    // Apply q filter (simplified FTS for in-memory)
    if (options.q && options.q.trim().length > 0) {
      const q = options.q.toLowerCase();
      results = results.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          (c.description?.toLowerCase().includes(q) ?? false) ||
          (c.shortDescription?.toLowerCase().includes(q) ?? false),
      );
    }

    // Apply status filter
    if (options.status) {
      if (options.status === 'active') {
        results = results.filter((c) => c.status === 'live');
      } else if (options.status === 'funded') {
        results = results.filter((c) => c.status === 'funded');
      } else if (options.status === 'ending_soon') {
        results = results.filter(
          (c) =>
            c.deadline !== null &&
            c.deadline.getTime() <= now.getTime() + sevenDaysMs &&
            c.deadline.getTime() >= now.getTime(),
        );
      }
    }

    // Apply categories filter
    if (options.categories && options.categories.length > 0) {
      results = results.filter(
        (c) => c.category !== null && options.categories?.includes(c.category),
      );
    }

    // Apply sort
    const sort = options.sort ?? 'newest';
    if (sort === 'newest') {
      results.sort((a, b) => {
        const aTime = a.launchedAt?.getTime() ?? 0;
        const bTime = b.launchedAt?.getTime() ?? 0;
        return bTime - aTime;
      });
    } else if (sort === 'ending_soon') {
      // Exclude campaigns with null deadline
      results = results.filter((c) => c.deadline !== null);
      results.sort((a, b) => {
        const aTime = a.deadline?.getTime() ?? 0;
        const bTime = b.deadline?.getTime() ?? 0;
        return aTime - bTime;
      });
    } else if (sort === 'most_funded') {
      results.sort((a, b) => {
        const aGoal = a.fundingGoalCents ? BigInt(a.fundingGoalCents) : BigInt(0);
        const bGoal = b.fundingGoalCents ? BigInt(b.fundingGoalCents) : BigInt(0);
        return bGoal > aGoal ? 1 : bGoal < aGoal ? -1 : 0;
      });
    } else if (sort === 'least_funded') {
      results.sort((a, b) => {
        const aGoal = a.fundingGoalCents ? BigInt(a.fundingGoalCents) : BigInt(0);
        const bGoal = b.fundingGoalCents ? BigInt(b.fundingGoalCents) : BigInt(0);
        return aGoal > bGoal ? 1 : aGoal < bGoal ? -1 : 0;
      });
    }

    const total = results.length;
    const { offset, limit } = options;
    const items = results.slice(offset, offset + limit).map((c) => ({
      id: c.id,
      title: c.title,
      shortDescription: c.shortDescription,
      category: c.category,
      heroImageUrl: c.heroImageUrl,
      status: c.status,
      fundingGoalCents: c.fundingGoalCents,
      deadline: c.deadline,
      launchedAt: c.launchedAt,
      creatorName: null, // No user lookup in in-memory adapter
      totalRaisedCents: '0' as string,
      contributorCount: 0,
      fundingPercentage: c.fundingGoalCents !== null ? 0 : null,
    }));

    return { items, total };
  }

  async findPublicById(id: string): Promise<PublicCampaignDetail | null> {
    const campaign = this.campaigns.get(id);
    if (!campaign) return null;
    if (!['live', 'funded'].includes(campaign.status)) return null;

    return {
      id: campaign.id,
      title: campaign.title,
      shortDescription: campaign.shortDescription,
      category: campaign.category,
      heroImageUrl: campaign.heroImageUrl,
      status: campaign.status,
      fundingGoalCents: campaign.fundingGoalCents,
      fundingCapCents: campaign.fundingCapCents,
      deadline: campaign.deadline,
      launchedAt: campaign.launchedAt,
      creatorName: null,
      totalRaisedCents: '0',
      contributorCount: 0,
      fundingPercentage: campaign.fundingGoalCents !== null ? 0 : null,
      description: campaign.description,
      milestones: campaign.milestones,
      teamMembers: campaign.teamMembers,
      riskDisclosures: campaign.riskDisclosures,
      budgetBreakdown: campaign.budgetBreakdown,
      alignmentStatement: campaign.alignmentStatement,
      tags: campaign.tags,
    };
  }

  async getCategoryStats(category: CampaignCategory): Promise<CategoryStats> {
    const campaigns = Array.from(this.campaigns.values());
    const inCategory = campaigns.filter((c) => c.category === category);
    const campaignCount = inCategory.filter((c) => ['live', 'funded'].includes(c.status)).length;
    const activeCampaignCount = inCategory.filter((c) => c.status === 'live').length;

    return {
      category,
      campaignCount,
      activeCampaignCount,
      totalRaisedCents: '0',
      contributorCount: 0,
    };
  }
}
