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
  Propulsion:               'propulsion',
  EntryDescentLanding:      'entry_descent_landing',
  PowerEnergy:              'power_energy',
  HabitatsConstruction:     'habitats_construction',
  LifeSupportCrewHealth:    'life_support_crew_health',
  FoodWaterProduction:      'food_water_production',
  InSituResourceUtilisation:'in_situ_resource_utilisation',
  RadiationProtection:      'radiation_protection',
  RoboticsAutomation:       'robotics_automation',
  CommunicationsNavigation: 'communications_navigation',
} as const;

export type CampaignCategory = (typeof CampaignCategory)[keyof typeof CampaignCategory];

export const CAMPAIGN_CATEGORY_LABELS: Record<CampaignCategory, string> = {
  propulsion:                 'Propulsion',
  entry_descent_landing:      'Entry, Descent & Landing',
  power_energy:               'Power & Energy',
  habitats_construction:      'Habitats & Construction',
  life_support_crew_health:   'Life Support & Crew Health',
  food_water_production:      'Food & Water Production',
  in_situ_resource_utilisation: 'In-Situ Resource Utilisation',
  radiation_protection:       'Radiation Protection',
  robotics_automation:        'Robotics & Automation',
  communications_navigation:  'Communications & Navigation',
};

export interface Milestone {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly fundingBasisPoints: number; // integer, sum must = 10000 at submission
  readonly targetDate: string | null;  // YYYY-MM-DD date string or null
}

export interface TeamMember {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly bio: string | null;
  readonly linkedInUrl: string | null;
}

export interface RiskDisclosure {
  readonly id: string;
  readonly risk: string;        // max 500 chars
  readonly mitigation: string;  // max 500 chars
}

export interface BudgetItem {
  readonly id: string;
  readonly category: string;        // max 100 chars
  readonly description: string;     // max 500 chars
  readonly estimatedCents: string;  // integer cents as string — never parse to Number (G-024)
  readonly notes?: string;          // max 200 chars
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
