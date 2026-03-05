/**
 * Campaign API types for feat-005.
 * Monetary amounts are strings (integer cents) to avoid precision loss.
 */

export type CampaignStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'live'
  | 'funded'
  | 'suspended'
  | 'failed'
  | 'settlement'
  | 'complete'
  | 'cancelled';

export type CampaignCategory =
  | 'propulsion'
  | 'entry_descent_landing'
  | 'power_energy'
  | 'habitats_construction'
  | 'life_support_crew_health'
  | 'food_water_production'
  | 'isru'
  | 'radiation_protection'
  | 'robotics_automation'
  | 'communications_navigation';

export interface MilestoneResponse {
  readonly id: string;
  readonly campaign_id: string;
  readonly title: string | null;
  readonly description: string | null;
  readonly target_date: string | null;
  readonly funding_percentage: number | null;
  readonly verification_criteria: string | null;
  readonly status: 'pending' | 'verified' | 'returned';
  readonly created_at: string;
  readonly updated_at: string;
}

export interface CampaignResponse {
  readonly id: string;
  readonly creator_id: string;
  readonly title: string;
  readonly summary: string | null;
  readonly description: string | null;
  readonly mars_alignment_statement: string | null;
  readonly category: CampaignCategory;
  readonly status: CampaignStatus;
  /** Integer cents as string */
  readonly min_funding_target_cents: string;
  /** Integer cents as string */
  readonly max_funding_cap_cents: string;
  readonly deadline: string | null;
  readonly budget_breakdown: string | null;
  readonly team_info: string | null;
  readonly risk_disclosures: string | null;
  readonly hero_image_url: string | null;
  readonly milestones: readonly MilestoneResponse[];
  readonly created_at: string;
  readonly updated_at: string;
}

export interface MilestoneInput {
  readonly title?: string | null;
  readonly description?: string | null;
  readonly target_date?: string | null;
  readonly funding_percentage?: number | null;
  readonly verification_criteria?: string | null;
}

export interface CreateCampaignInput {
  readonly title: string;
  readonly category: CampaignCategory;
  /** Integer cents as string */
  readonly min_funding_target_cents: string;
  /** Integer cents as string */
  readonly max_funding_cap_cents: string;
  readonly summary?: string | null;
  readonly description?: string | null;
  readonly mars_alignment_statement?: string | null;
  readonly deadline?: string | null;
  readonly budget_breakdown?: string | null;
  readonly team_info?: string | null;
  readonly risk_disclosures?: string | null;
  readonly hero_image_url?: string | null;
  readonly milestones?: readonly MilestoneInput[];
}

export interface UpdateCampaignInput {
  readonly title?: string | null;
  readonly category?: CampaignCategory | null;
  readonly min_funding_target_cents?: string | null;
  readonly max_funding_cap_cents?: string | null;
  readonly summary?: string | null;
  readonly description?: string | null;
  readonly mars_alignment_statement?: string | null;
  readonly deadline?: string | null;
  readonly budget_breakdown?: string | null;
  readonly team_info?: string | null;
  readonly risk_disclosures?: string | null;
  readonly hero_image_url?: string | null;
  readonly milestones?: readonly MilestoneInput[] | null;
}

export interface CampaignApiResponse {
  readonly data: CampaignResponse;
}

export interface CampaignListApiResponse {
  readonly data: readonly CampaignResponse[];
}
