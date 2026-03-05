import type { Pool } from 'pg';
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
import {
  Campaign,
  type CampaignData,
  type UpdateCampaignInput,
} from '../domain/models/campaign.js';
import type { CampaignCategory } from '../domain/value-objects/campaign-category.js';
import type { CampaignStatus } from '../domain/value-objects/campaign-status.js';
import type {
  CampaignRepository,
  CampaignStatusUpdate,
  ListCampaignOptions,
} from '../ports/campaign-repository.port.js';

// DB row shape from postgres
interface CampaignRow {
  id: string;
  creator_user_id: string;
  title: string;
  short_description: string | null;
  description: string | null;
  category: string | null;
  hero_image_url: string | null;
  funding_goal_cents: string | null; // BIGINT returned as string by pg (G-024)
  funding_cap_cents: string | null; // BIGINT returned as string by pg
  deadline: Date | string | null;
  milestones: unknown;
  team_members: unknown;
  risk_disclosures: unknown;
  budget_breakdown: unknown;
  alignment_statement: string | null;
  tags: string[];
  status: string;
  rejection_reason: string | null;
  resubmission_guidance: string | null;
  review_notes: string | null;
  reviewed_by_user_id: string | null;
  reviewed_at: Date | string | null;
  submitted_at: Date | string | null;
  launched_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function toNullableDate(value: Date | string | null): Date | null {
  if (value === null) return null;
  return value instanceof Date ? value : new Date(value);
}

function rowToDomain(row: CampaignRow): Campaign {
  const data: CampaignData = {
    id: row.id,
    creatorUserId: row.creator_user_id,
    title: row.title,
    shortDescription: row.short_description,
    description: row.description,
    category: (row.category as CampaignCategory) ?? null,
    heroImageUrl: row.hero_image_url,
    // BIGINT columns returned as string by pg (G-024) — pass through as string
    fundingGoalCents: row.funding_goal_cents ?? null,
    fundingCapCents: row.funding_cap_cents ?? null,
    deadline: toNullableDate(row.deadline),
    milestones: Array.isArray(row.milestones) ? (row.milestones as CampaignData['milestones']) : [],
    teamMembers: Array.isArray(row.team_members)
      ? (row.team_members as CampaignData['teamMembers'])
      : [],
    riskDisclosures: Array.isArray(row.risk_disclosures)
      ? (row.risk_disclosures as CampaignData['riskDisclosures'])
      : [],
    budgetBreakdown: Array.isArray(row.budget_breakdown)
      ? (row.budget_breakdown as CampaignData['budgetBreakdown'])
      : [],
    alignmentStatement: row.alignment_statement,
    tags: row.tags ?? [],
    status: row.status as CampaignStatus,
    rejectionReason: row.rejection_reason,
    resubmissionGuidance: row.resubmission_guidance,
    reviewNotes: row.review_notes,
    reviewedByUserId: row.reviewed_by_user_id,
    reviewedAt: toNullableDate(row.reviewed_at),
    submittedAt: toNullableDate(row.submitted_at),
    launchedAt: toNullableDate(row.launched_at),
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };

  return Campaign.reconstitute(data);
}

export class PgCampaignRepository implements CampaignRepository {
  constructor(private readonly pool: Pool) {}

  async save(campaign: Campaign): Promise<void> {
    await this.pool.query(
      `INSERT INTO campaigns (
        id, creator_user_id, title, status, created_at, updated_at
      ) VALUES ($1, $2, $3, 'draft', NOW(), NOW())`,
      [campaign.id, campaign.creatorUserId, campaign.title],
    );
  }

  async findById(id: string): Promise<Campaign | null> {
    const result = await this.pool.query<CampaignRow>('SELECT * FROM campaigns WHERE id = $1', [
      id,
    ]);
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    if (!row) return null;
    return rowToDomain(row);
  }

  async findByCreatorUserId(
    creatorUserId: string,
    options?: ListCampaignOptions,
  ): Promise<Campaign[]> {
    const limit = options?.limit ?? 100;
    const offset = options?.offset ?? 0;

    const result = await this.pool.query<CampaignRow>(
      `SELECT * FROM campaigns
       WHERE creator_user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [creatorUserId, limit, offset],
    );

    return result.rows.map(rowToDomain);
  }

  async findSubmittedOrderedBySubmittedAt(options?: ListCampaignOptions): Promise<Campaign[]> {
    const limit = options?.limit ?? 100;
    const offset = options?.offset ?? 0;

    const result = await this.pool.query<CampaignRow>(
      `SELECT * FROM campaigns
       WHERE status = 'submitted'
       ORDER BY submitted_at ASC
       LIMIT $1 OFFSET $2`,
      [limit, offset],
    );

    return result.rows.map(rowToDomain);
  }

  async updateStatus(
    campaignId: string,
    fromStatus: CampaignStatus,
    toStatus: CampaignStatus,
    updates?: CampaignStatusUpdate,
  ): Promise<Campaign> {
    const result = await this.pool.query<CampaignRow>(
      `UPDATE campaigns
       SET status              = $2,
           reviewed_by_user_id = COALESCE($3, reviewed_by_user_id),
           review_notes        = COALESCE($4, review_notes),
           rejection_reason    = COALESCE($5, rejection_reason),
           resubmission_guidance = COALESCE($6, resubmission_guidance),
           reviewed_at         = COALESCE($7, reviewed_at),
           submitted_at        = COALESCE($8, submitted_at),
           launched_at         = COALESCE($9, launched_at),
           updated_at          = NOW()
       WHERE id     = $1
         AND status = $10
       RETURNING *`,
      [
        campaignId,
        toStatus,
        updates?.reviewedByUserId ?? null,
        updates?.reviewNotes ?? null,
        updates?.rejectionReason ?? null,
        updates?.resubmissionGuidance ?? null,
        updates?.reviewedAt ?? null,
        updates?.submittedAt ?? null,
        updates?.launchedAt ?? null,
        fromStatus,
      ],
    );

    if (result.rowCount === 0) {
      throw new CampaignAlreadyClaimedError();
    }

    const row = result.rows[0];
    if (!row) {
      throw new CampaignAlreadyClaimedError();
    }

    return rowToDomain(row);
  }

  async updateDraftFields(campaignId: string, input: UpdateCampaignInput): Promise<Campaign> {
    // Build SET clause dynamically from provided fields (G-026)
    const fieldMap: Record<string, string> = {
      title: 'title',
      shortDescription: 'short_description',
      description: 'description',
      category: 'category',
      heroImageUrl: 'hero_image_url',
      fundingGoalCents: 'funding_goal_cents',
      fundingCapCents: 'funding_cap_cents',
      deadline: 'deadline',
      milestones: 'milestones',
      teamMembers: 'team_members',
      riskDisclosures: 'risk_disclosures',
      budgetBreakdown: 'budget_breakdown',
      alignmentStatement: 'alignment_statement',
      tags: 'tags',
    };

    const jsonbFields = new Set([
      'milestones',
      'teamMembers',
      'riskDisclosures',
      'budgetBreakdown',
    ]);

    const setClauses: string[] = [];
    const values: unknown[] = [campaignId]; // $1 = campaignId
    let paramIndex = 2;

    for (const [camelKey, snakeKey] of Object.entries(fieldMap)) {
      const value = (input as Record<string, unknown>)[camelKey];
      if (value === undefined) continue;

      if (jsonbFields.has(camelKey)) {
        setClauses.push(`${snakeKey} = $${paramIndex}::JSONB`);
        values.push(JSON.stringify(value));
      } else {
        setClauses.push(`${snakeKey} = $${paramIndex}`);
        values.push(value);
      }
      paramIndex++;
    }

    if (setClauses.length === 0) {
      // Nothing to update — just return current state
      const current = await this.findById(campaignId);
      if (!current) throw new CampaignNotFoundError();
      return current;
    }

    setClauses.push('updated_at = NOW()');

    const result = await this.pool.query<CampaignRow>(
      `UPDATE campaigns
       SET ${setClauses.join(', ')}
       WHERE id = $1
       RETURNING *`,
      values,
    );

    const row = result.rows[0];
    if (!row) {
      throw new CampaignNotFoundError();
    }

    return rowToDomain(row);
  }

  async searchPublicCampaigns(options: PublicSearchOptions): Promise<PublicSearchResult> {
    const q = options.q ?? '';
    const statusFilter = options.status ?? null;
    const categories =
      options.categories && options.categories.length > 0 ? Array.from(options.categories) : null;
    const sort = options.sort ?? 'newest';
    const { limit, offset } = options;

    // Main query
    const searchQuery = `
      SELECT
        c.id,
        c.title,
        c.short_description,
        c.category,
        c.hero_image_url,
        c.status,
        c.funding_goal_cents::TEXT AS funding_goal_cents,
        c.deadline,
        c.launched_at,
        u.display_name AS creator_name,
        CASE WHEN $1 != '' AND c.search_vector IS NOT NULL
          THEN ts_rank(c.search_vector, websearch_to_tsquery('english', $1))
          ELSE 0
        END AS rank
      FROM campaigns c
      JOIN users u ON c.creator_user_id = u.id
      WHERE c.status IN ('live', 'funded')
        AND (
          $2::TEXT IS NULL OR (
            CASE $2::TEXT
              WHEN 'active'      THEN c.status = 'live'
              WHEN 'funded'      THEN c.status = 'funded'
              WHEN 'ending_soon' THEN c.status IN ('live', 'funded')
                                      AND c.deadline <= NOW() + INTERVAL '7 days'
                                      AND c.deadline >= NOW()
              ELSE TRUE
            END
          )
        )
        AND ($3::TEXT[] IS NULL OR c.category = ANY($3::TEXT[]))
        AND (
          $1 = ''
          OR c.search_vector @@ websearch_to_tsquery('english', $1)
          OR to_tsvector('english', COALESCE(u.display_name, '')) @@ websearch_to_tsquery('english', $1)
        )
      ORDER BY
        CASE WHEN $4::TEXT = 'newest'      THEN NULL END DESC,
        CASE WHEN $4::TEXT = 'newest'      THEN c.launched_at END DESC NULLS LAST,
        CASE WHEN $4::TEXT = 'ending_soon' THEN c.deadline END ASC NULLS LAST,
        CASE WHEN $4::TEXT = 'most_funded' THEN c.funding_goal_cents END DESC NULLS LAST,
        CASE WHEN $4::TEXT = 'least_funded' THEN c.funding_goal_cents END ASC NULLS LAST,
        CASE WHEN $1 != '' AND $4::TEXT IS NULL
          THEN CASE WHEN c.search_vector IS NOT NULL
            THEN ts_rank(c.search_vector, websearch_to_tsquery('english', $1))
            ELSE 0
          END
        END DESC,
        c.launched_at DESC NULLS LAST
      LIMIT $5 OFFSET $6
    `;

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM campaigns c
      JOIN users u ON c.creator_user_id = u.id
      WHERE c.status IN ('live', 'funded')
        AND (
          $2::TEXT IS NULL OR (
            CASE $2::TEXT
              WHEN 'active'      THEN c.status = 'live'
              WHEN 'funded'      THEN c.status = 'funded'
              WHEN 'ending_soon' THEN c.status IN ('live', 'funded')
                                      AND c.deadline <= NOW() + INTERVAL '7 days'
                                      AND c.deadline >= NOW()
              ELSE TRUE
            END
          )
        )
        AND ($3::TEXT[] IS NULL OR c.category = ANY($3::TEXT[]))
        AND (
          $1 = ''
          OR c.search_vector @@ websearch_to_tsquery('english', $1)
          OR to_tsvector('english', COALESCE(u.display_name, '')) @@ websearch_to_tsquery('english', $1)
        )
    `;

    const params = [q, statusFilter, categories, sort, limit, offset];
    const countParams = [q, statusFilter, categories];

    interface PublicCampaignRow {
      id: string;
      title: string;
      short_description: string | null;
      category: string | null;
      hero_image_url: string | null;
      status: string;
      funding_goal_cents: string | null;
      deadline: Date | string | null;
      launched_at: Date | string | null;
      creator_name: string | null;
      rank: string | null;
    }

    const [rowsResult, countResult] = await Promise.all([
      this.pool.query<PublicCampaignRow>(searchQuery, params),
      this.pool.query<{ total: string }>(countQuery, countParams),
    ]);

    const total = parseInt(countResult.rows[0]?.total ?? '0', 10);

    const items = rowsResult.rows.map((row) => ({
      id: row.id,
      title: row.title,
      shortDescription: row.short_description,
      category: row.category,
      heroImageUrl: row.hero_image_url,
      status: row.status,
      fundingGoalCents: row.funding_goal_cents,
      deadline: toNullableDate(row.deadline),
      launchedAt: toNullableDate(row.launched_at),
      creatorName: row.creator_name,
      totalRaisedCents: '0' as string,
      contributorCount: 0,
      fundingPercentage: row.funding_goal_cents !== null ? 0 : null,
    }));

    return { items, total };
  }

  async findPublicById(id: string): Promise<PublicCampaignDetail | null> {
    interface PublicCampaignDetailRow {
      id: string;
      title: string;
      short_description: string | null;
      description: string | null;
      category: string | null;
      hero_image_url: string | null;
      status: string;
      funding_goal_cents: string | null;
      funding_cap_cents: string | null;
      deadline: Date | string | null;
      launched_at: Date | string | null;
      milestones: unknown;
      team_members: unknown;
      risk_disclosures: unknown;
      budget_breakdown: unknown;
      alignment_statement: string | null;
      tags: string[] | null;
      creator_name: string | null;
    }

    const result = await this.pool.query<PublicCampaignDetailRow>(
      `SELECT
        c.id,
        c.title,
        c.short_description,
        c.description,
        c.category,
        c.hero_image_url,
        c.status,
        c.funding_goal_cents::TEXT AS funding_goal_cents,
        c.funding_cap_cents::TEXT AS funding_cap_cents,
        c.deadline,
        c.launched_at,
        c.milestones,
        c.team_members,
        c.risk_disclosures,
        c.budget_breakdown,
        c.alignment_statement,
        c.tags,
        u.display_name AS creator_name
      FROM campaigns c
      JOIN users u ON c.creator_user_id = u.id
      WHERE c.id = $1
        AND c.status IN ('live', 'funded')`,
      [id],
    );

    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    if (!row) return null;

    return {
      id: row.id,
      title: row.title,
      shortDescription: row.short_description,
      description: row.description,
      category: row.category,
      heroImageUrl: row.hero_image_url,
      status: row.status,
      fundingGoalCents: row.funding_goal_cents,
      fundingCapCents: row.funding_cap_cents,
      deadline: toNullableDate(row.deadline),
      launchedAt: toNullableDate(row.launched_at),
      creatorName: row.creator_name,
      totalRaisedCents: '0',
      contributorCount: 0,
      fundingPercentage: row.funding_goal_cents !== null ? 0 : null,
      milestones: Array.isArray(row.milestones)
        ? (row.milestones as CampaignData['milestones'])
        : [],
      teamMembers: Array.isArray(row.team_members)
        ? (row.team_members as CampaignData['teamMembers'])
        : [],
      riskDisclosures: Array.isArray(row.risk_disclosures)
        ? (row.risk_disclosures as CampaignData['riskDisclosures'])
        : [],
      budgetBreakdown: Array.isArray(row.budget_breakdown)
        ? (row.budget_breakdown as CampaignData['budgetBreakdown'])
        : [],
      alignmentStatement: row.alignment_statement,
      tags: row.tags ?? [],
    };
  }

  async getCategoryStats(category: CampaignCategory): Promise<CategoryStats> {
    const result = await this.pool.query<{
      campaign_count: string;
      active_campaign_count: string;
    }>(
      `SELECT
        COUNT(*) FILTER (WHERE status IN ('live', 'funded')) AS campaign_count,
        COUNT(*) FILTER (WHERE status = 'live') AS active_campaign_count
      FROM campaigns
      WHERE category = $1`,
      [category],
    );

    const row = result.rows[0];
    return {
      category,
      campaignCount: parseInt(row?.campaign_count ?? '0', 10),
      activeCampaignCount: parseInt(row?.active_campaign_count ?? '0', 10),
      totalRaisedCents: '0',
      contributorCount: 0,
    };
  }
}
