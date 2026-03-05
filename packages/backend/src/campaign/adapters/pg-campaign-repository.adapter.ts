import type { Pool } from 'pg';
import { Campaign, type CampaignData, type UpdateCampaignInput } from '../domain/models/campaign.js';
import type { CampaignCategory } from '../domain/value-objects/campaign-category.js';
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
  funding_cap_cents: string | null;  // BIGINT returned as string by pg
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
    milestones: Array.isArray(row.milestones) ? row.milestones as CampaignData['milestones'] : [],
    teamMembers: Array.isArray(row.team_members) ? row.team_members as CampaignData['teamMembers'] : [],
    riskDisclosures: Array.isArray(row.risk_disclosures) ? row.risk_disclosures as CampaignData['riskDisclosures'] : [],
    budgetBreakdown: Array.isArray(row.budget_breakdown) ? row.budget_breakdown as CampaignData['budgetBreakdown'] : [],
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
    const result = await this.pool.query<CampaignRow>(
      'SELECT * FROM campaigns WHERE id = $1',
      [id],
    );
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

    const jsonbFields = new Set(['milestones', 'teamMembers', 'riskDisclosures', 'budgetBreakdown']);

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
}
