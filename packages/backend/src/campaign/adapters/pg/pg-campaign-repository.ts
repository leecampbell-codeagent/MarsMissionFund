import type { Pool } from 'pg';
import {
  Campaign,
  type CampaignCategory,
  type CampaignStatus,
} from '../../domain/campaign.js';
import { Milestone, type MilestoneStatus } from '../../domain/milestone.js';
import type { CampaignRepository } from '../../ports/campaign-repository.js';

export class PgCampaignRepository implements CampaignRepository {
  constructor(private readonly pool: Pool) {}

  async findById(id: string): Promise<{ campaign: Campaign; milestones: Milestone[] } | null> {
    const campaignResult = await this.pool.query(
      'SELECT * FROM campaigns WHERE id = $1',
      [id],
    );
    if (campaignResult.rows.length === 0) return null;

    const campaign = this.toCampaignDomain(campaignResult.rows[0]);

    const milestonesResult = await this.pool.query(
      'SELECT * FROM milestones WHERE campaign_id = $1 ORDER BY target_date ASC, created_at ASC',
      [id],
    );
    const milestones = milestonesResult.rows.map((row) => this.toMilestoneDomain(row));

    return { campaign, milestones };
  }

  async findSubmitted(): Promise<{ campaign: Campaign; milestones: Milestone[] }[]> {
    const campaignResult = await this.pool.query(
      `SELECT * FROM campaigns WHERE status IN ('submitted', 'under_review') ORDER BY created_at ASC`,
    );

    if (campaignResult.rows.length === 0) return [];

    const results: { campaign: Campaign; milestones: Milestone[] }[] = [];
    for (const row of campaignResult.rows) {
      const campaign = this.toCampaignDomain(row);
      const milestonesResult = await this.pool.query(
        'SELECT * FROM milestones WHERE campaign_id = $1 ORDER BY target_date ASC, created_at ASC',
        [campaign.id],
      );
      results.push({
        campaign,
        milestones: milestonesResult.rows.map((r) => this.toMilestoneDomain(r)),
      });
    }

    return results;
  }

  async findByCreatorId(
    creatorId: string,
  ): Promise<{ campaign: Campaign; milestones: Milestone[] }[]> {
    const campaignResult = await this.pool.query(
      'SELECT * FROM campaigns WHERE creator_id = $1 ORDER BY created_at DESC',
      [creatorId],
    );

    if (campaignResult.rows.length === 0) return [];

    const results: { campaign: Campaign; milestones: Milestone[] }[] = [];
    for (const row of campaignResult.rows) {
      const campaign = this.toCampaignDomain(row);
      const milestonesResult = await this.pool.query(
        'SELECT * FROM milestones WHERE campaign_id = $1 ORDER BY target_date ASC, created_at ASC',
        [campaign.id],
      );
      results.push({
        campaign,
        milestones: milestonesResult.rows.map((r) => this.toMilestoneDomain(r)),
      });
    }

    return results;
  }

  async save(campaign: Campaign, milestones: readonly Milestone[]): Promise<void> {
    await this.pool.query(
      `INSERT INTO campaigns (
        id, creator_id, title, summary, description, mars_alignment_statement,
        category, status, min_funding_target_cents, max_funding_cap_cents,
        deadline, budget_breakdown, team_info, risk_disclosures, hero_image_url,
        reviewer_id, reviewer_comment, reviewed_at,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`,
      [
        campaign.id,
        campaign.creatorId,
        campaign.title,
        campaign.summary,
        campaign.description,
        campaign.marsAlignmentStatement,
        campaign.category,
        campaign.status,
        campaign.minFundingTargetCents,
        campaign.maxFundingCapCents,
        campaign.deadline,
        campaign.budgetBreakdown,
        campaign.teamInfo,
        campaign.riskDisclosures,
        campaign.heroImageUrl,
        campaign.reviewerId,
        campaign.reviewerComment,
        campaign.reviewedAt,
        campaign.createdAt,
        campaign.updatedAt,
      ],
    );

    for (const milestone of milestones) {
      await this.insertMilestone(milestone);
    }
  }

  async update(campaign: Campaign, milestones?: readonly Milestone[]): Promise<void> {
    await this.pool.query(
      `UPDATE campaigns SET
        title = $2,
        summary = $3,
        description = $4,
        mars_alignment_statement = $5,
        category = $6,
        status = $7,
        min_funding_target_cents = $8,
        max_funding_cap_cents = $9,
        deadline = $10,
        budget_breakdown = $11,
        team_info = $12,
        risk_disclosures = $13,
        hero_image_url = $14,
        reviewer_id = $15,
        reviewer_comment = $16,
        reviewed_at = $17,
        updated_at = $18
      WHERE id = $1`,
      [
        campaign.id,
        campaign.title,
        campaign.summary,
        campaign.description,
        campaign.marsAlignmentStatement,
        campaign.category,
        campaign.status,
        campaign.minFundingTargetCents,
        campaign.maxFundingCapCents,
        campaign.deadline,
        campaign.budgetBreakdown,
        campaign.teamInfo,
        campaign.riskDisclosures,
        campaign.heroImageUrl,
        campaign.reviewerId,
        campaign.reviewerComment,
        campaign.reviewedAt,
        campaign.updatedAt,
      ],
    );

    if (milestones !== undefined) {
      // Delete existing milestones and re-insert
      await this.pool.query('DELETE FROM milestones WHERE campaign_id = $1', [campaign.id]);
      for (const milestone of milestones) {
        await this.insertMilestone(milestone);
      }
    }
  }

  private async insertMilestone(milestone: Milestone): Promise<void> {
    await this.pool.query(
      `INSERT INTO milestones (
        id, campaign_id, title, description, target_date,
        funding_percentage, verification_criteria, status,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        milestone.id,
        milestone.campaignId,
        milestone.title,
        milestone.description,
        milestone.targetDate,
        milestone.fundingPercentage,
        milestone.verificationCriteria,
        milestone.status,
        milestone.createdAt,
        milestone.updatedAt,
      ],
    );
  }

  private toCampaignDomain(row: Record<string, unknown>): Campaign {
    return Campaign.reconstitute({
      id: row.id as string,
      creatorId: row.creator_id as string,
      title: row.title as string,
      summary: (row.summary as string | null) ?? null,
      description: (row.description as string | null) ?? null,
      marsAlignmentStatement: (row.mars_alignment_statement as string | null) ?? null,
      category: row.category as CampaignCategory,
      status: row.status as CampaignStatus,
      minFundingTargetCents: Number(row.min_funding_target_cents),
      maxFundingCapCents: Number(row.max_funding_cap_cents),
      deadline: row.deadline ? new Date(row.deadline as string) : null,
      budgetBreakdown: (row.budget_breakdown as string | null) ?? null,
      teamInfo: (row.team_info as string | null) ?? null,
      riskDisclosures: (row.risk_disclosures as string | null) ?? null,
      heroImageUrl: (row.hero_image_url as string | null) ?? null,
      reviewerId: (row.reviewer_id as string | null) ?? null,
      reviewerComment: (row.reviewer_comment as string | null) ?? null,
      reviewedAt: row.reviewed_at ? new Date(row.reviewed_at as string) : null,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    });
  }

  private toMilestoneDomain(row: Record<string, unknown>): Milestone {
    return Milestone.reconstitute({
      id: row.id as string,
      campaignId: row.campaign_id as string,
      title: (row.title as string | null) ?? null,
      description: (row.description as string | null) ?? null,
      targetDate: row.target_date ? new Date(row.target_date as string) : null,
      fundingPercentage:
        row.funding_percentage !== null && row.funding_percentage !== undefined
          ? Number(row.funding_percentage)
          : null,
      verificationCriteria: (row.verification_criteria as string | null) ?? null,
      status: row.status as MilestoneStatus,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    });
  }
}
