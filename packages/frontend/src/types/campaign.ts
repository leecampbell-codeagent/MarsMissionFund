/**
 * Campaign domain types for the frontend.
 * All monetary amounts (*Cents fields) are strings — never parse to Number (G-024).
 * All dates are ISO 8601 UTC strings.
 */

export const CampaignStatus = {
  Draft: 'draft',
  Submitted: 'submitted',
  UnderReview: 'under_review',
  Approved: 'approved',
  Rejected: 'rejected',
  Live: 'live',
  Archived: 'archived',
} as const;

export type CampaignStatus = (typeof CampaignStatus)[keyof typeof CampaignStatus];

export const CampaignCategory = {
  PropulsionSystems: 'propulsion_systems',
  LifeSupport: 'life_support',
  HabitatConstruction: 'habitat_construction',
  ResourceExtraction: 'resource_extraction',
  CommunicationSystems: 'communication_systems',
  PowerGeneration: 'power_generation',
  FoodProduction: 'food_production',
  MedicalSystems: 'medical_systems',
  NavigationGuidance: 'navigation_guidance',
  WasteManagement: 'waste_management',
} as const;

export type CampaignCategory = (typeof CampaignCategory)[keyof typeof CampaignCategory];

export const CAMPAIGN_CATEGORY_LABELS: Record<CampaignCategory, string> = {
  propulsion_systems: 'Propulsion Systems',
  life_support: 'Life Support',
  habitat_construction: 'Habitat Construction',
  resource_extraction: 'Resource Extraction',
  communication_systems: 'Communication Systems',
  power_generation: 'Power Generation',
  food_production: 'Food Production',
  medical_systems: 'Medical Systems',
  navigation_guidance: 'Navigation & Guidance',
  waste_management: 'Waste Management',
};

export interface Milestone {
  readonly title: string;
  readonly description: string;
  readonly fundingBasisPoints: number; // integer, sum must = 10000 at submission
  readonly targetDate: string | null;  // ISO 8601 UTC string
}

export interface TeamMember {
  readonly name: string;
  readonly role: string;
  readonly bio: string | null;
  readonly linkedInUrl: string | null;
}

export interface RiskDisclosure {
  readonly title: string;
  readonly description: string;
  readonly severity: 'low' | 'medium' | 'high';
}

export interface BudgetItem {
  readonly category: string;
  readonly description: string;
  readonly amountCents: string; // string — never parse to Number (G-024)
}

export interface Campaign {
  readonly id: string;
  readonly creatorUserId: string;
  readonly title: string;
  readonly shortDescription: string | null;
  readonly description: string | null;
  readonly category: CampaignCategory | null;
  readonly heroImageUrl: string | null;
  readonly fundingGoalCents: string | null;   // string — never parse to Number (G-024)
  readonly fundingCapCents: string | null;    // string — never parse to Number (G-024)
  readonly deadline: string | null;           // ISO 8601 UTC string
  readonly milestones: Milestone[];
  readonly teamMembers: TeamMember[];
  readonly riskDisclosures: RiskDisclosure[];
  readonly budgetBreakdown: BudgetItem[];
  readonly alignmentStatement: string | null;
  readonly tags: string[];
  readonly status: CampaignStatus;
  readonly rejectionReason: string | null;
  readonly resubmissionGuidance: string | null;
  readonly reviewNotes: string | null;
  readonly reviewedByUserId: string | null;
  readonly reviewedAt: string | null;
  readonly submittedAt: string | null;
  readonly launchedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CampaignSummary {
  readonly id: string;
  readonly creatorUserId: string;
  readonly title: string;
  readonly status: CampaignStatus;
  readonly category: CampaignCategory | null;
  readonly fundingGoalCents: string | null;
  readonly submittedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface UpdateCampaignInput {
  readonly title?: string;
  readonly shortDescription?: string | null;
  readonly description?: string | null;
  readonly category?: CampaignCategory | null;
  readonly heroImageUrl?: string | null;
  readonly fundingGoalCents?: string | null;
  readonly fundingCapCents?: string | null;
  readonly deadline?: string | null;
  readonly milestones?: Milestone[];
  readonly teamMembers?: TeamMember[];
  readonly riskDisclosures?: RiskDisclosure[];
  readonly budgetBreakdown?: BudgetItem[];
  readonly alignmentStatement?: string | null;
  readonly tags?: string[];
}

/**
 * Format cents string to USD display string.
 * Safe: MMF amounts fit in Number.MAX_SAFE_INTEGER.
 */
export function formatCents(cents: string): string {
  const dollars = Number(cents) / 100;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(dollars);
}

/**
 * Format basis points to percentage display string.
 */
export function formatBasisPoints(basisPoints: number): string {
  return `${(basisPoints / 100).toFixed(2)}%`;
}
