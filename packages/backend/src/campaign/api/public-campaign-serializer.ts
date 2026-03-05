import type {
  CategoryStats,
  PublicCampaignDetail,
  PublicCampaignListItem,
} from '../application/campaign-app-service.js';

/**
 * Computes days remaining until deadline.
 * Returns null when deadline is null.
 * Returns 0 when deadline has passed.
 */
function computeDaysRemaining(deadline: Date | null, now: Date): number | null {
  if (!deadline) return null;
  const diffMs = deadline.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

/**
 * Serializes a public campaign list item for API responses.
 * Computes daysRemaining from deadline and now.
 */
export function serializePublicCampaignListItem(
  item: PublicCampaignListItem,
  now: Date,
): Record<string, unknown> {
  return {
    id: item.id,
    title: item.title,
    shortDescription: item.shortDescription,
    category: item.category,
    heroImageUrl: item.heroImageUrl,
    status: item.status,
    fundingGoalCents: item.fundingGoalCents, // string | null (G-024)
    totalRaisedCents: item.totalRaisedCents, // '0' in feat-004
    contributorCount: item.contributorCount, // 0 in feat-004
    fundingPercentage: item.fundingPercentage, // 0.00 | null
    deadline: item.deadline?.toISOString() ?? null,
    daysRemaining: computeDaysRemaining(item.deadline, now),
    launchedAt: item.launchedAt?.toISOString() ?? null,
    creatorName: item.creatorName,
  };
}

/**
 * Serializes a full public campaign detail for API responses.
 * Includes all list item fields plus full content fields.
 */
export function serializePublicCampaignDetail(
  detail: PublicCampaignDetail,
  now: Date,
): Record<string, unknown> {
  return {
    ...serializePublicCampaignListItem(detail, now),
    description: detail.description,
    fundingCapCents: detail.fundingCapCents,
    milestones: detail.milestones,
    teamMembers: detail.teamMembers,
    riskDisclosures: detail.riskDisclosures,
    budgetBreakdown: detail.budgetBreakdown,
    alignmentStatement: detail.alignmentStatement,
    tags: detail.tags,
  };
}

/**
 * Serializes category aggregate stats for API responses.
 */
export function serializeCategoryStats(stats: CategoryStats): Record<string, unknown> {
  return {
    category: stats.category,
    campaignCount: stats.campaignCount,
    activeCampaignCount: stats.activeCampaignCount,
    totalRaisedCents: stats.totalRaisedCents, // '0' in feat-004
    contributorCount: stats.contributorCount, // 0 in feat-004
  };
}
