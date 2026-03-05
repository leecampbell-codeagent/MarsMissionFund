import type { Campaign } from '../domain/models/campaign.js';

/**
 * Serializes a full Campaign entity for API responses.
 * Monetary amounts (fundingGoalCents, fundingCapCents, estimatedCents) are strings (G-024).
 */
export function serializeCampaign(campaign: Campaign): Record<string, unknown> {
  return {
    id: campaign.id,
    creatorUserId: campaign.creatorUserId,
    title: campaign.title,
    shortDescription: campaign.shortDescription,
    description: campaign.description,
    category: campaign.category,
    heroImageUrl: campaign.heroImageUrl,
    fundingGoalCents: campaign.fundingGoalCents, // string or null (G-024)
    fundingCapCents: campaign.fundingCapCents,    // string or null (G-024)
    deadline: campaign.deadline?.toISOString() ?? null,
    milestones: campaign.milestones,
    teamMembers: campaign.teamMembers,
    riskDisclosures: campaign.riskDisclosures,
    budgetBreakdown: campaign.budgetBreakdown,
    alignmentStatement: campaign.alignmentStatement,
    tags: campaign.tags,
    status: campaign.status,
    rejectionReason: campaign.rejectionReason,
    resubmissionGuidance: campaign.resubmissionGuidance,
    reviewNotes: campaign.reviewNotes,
    reviewedByUserId: campaign.reviewedByUserId,
    reviewedAt: campaign.reviewedAt?.toISOString() ?? null,
    submittedAt: campaign.submittedAt?.toISOString() ?? null,
    launchedAt: campaign.launchedAt?.toISOString() ?? null,
    createdAt: campaign.createdAt.toISOString(),
    updatedAt: campaign.updatedAt.toISOString(),
  };
}

/**
 * Serializes a Campaign for the review queue summary view.
 * Only includes: id, title, category, fundingGoalCents, submittedAt, creatorUserId, status.
 */
export function serializeCampaignSummary(campaign: Campaign): Record<string, unknown> {
  return {
    id: campaign.id,
    title: campaign.title,
    category: campaign.category,
    fundingGoalCents: campaign.fundingGoalCents,
    submittedAt: campaign.submittedAt?.toISOString() ?? null,
    creatorUserId: campaign.creatorUserId,
    status: campaign.status,
    createdAt: campaign.createdAt.toISOString(),
    updatedAt: campaign.updatedAt.toISOString(),
  };
}
