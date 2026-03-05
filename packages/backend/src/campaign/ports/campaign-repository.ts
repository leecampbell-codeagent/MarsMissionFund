import type { Campaign } from '../domain/campaign.js';
import type { Milestone } from '../domain/milestone.js';

export interface CampaignRepository {
  findById(id: string): Promise<{ campaign: Campaign; milestones: Milestone[] } | null>;
  findByCreatorId(creatorId: string): Promise<{ campaign: Campaign; milestones: Milestone[] }[]>;
  save(campaign: Campaign, milestones: readonly Milestone[]): Promise<void>;
  update(campaign: Campaign, milestones?: readonly Milestone[]): Promise<void>;
}
