import type { Campaign } from '../../domain/campaign.js';
import type { Milestone } from '../../domain/milestone.js';
import type { CampaignRepository } from '../../ports/campaign-repository.js';

export class InMemoryCampaignRepository implements CampaignRepository {
  private readonly campaigns = new Map<string, Campaign>();
  private readonly milestones = new Map<string, Milestone[]>(); // campaignId -> milestones

  async findById(id: string): Promise<{ campaign: Campaign; milestones: Milestone[] } | null> {
    const campaign = this.campaigns.get(id);
    if (!campaign) return null;
    return { campaign, milestones: this.milestones.get(id) ?? [] };
  }

  async findByCreatorId(
    creatorId: string,
  ): Promise<{ campaign: Campaign; milestones: Milestone[] }[]> {
    const results: { campaign: Campaign; milestones: Milestone[] }[] = [];
    for (const campaign of this.campaigns.values()) {
      if (campaign.creatorId === creatorId) {
        results.push({ campaign, milestones: this.milestones.get(campaign.id) ?? [] });
      }
    }
    return results;
  }

  async save(campaign: Campaign, milestones: readonly Milestone[]): Promise<void> {
    this.campaigns.set(campaign.id, campaign);
    this.milestones.set(campaign.id, [...milestones]);
  }

  async update(campaign: Campaign, milestones?: readonly Milestone[]): Promise<void> {
    this.campaigns.set(campaign.id, campaign);
    if (milestones !== undefined) {
      this.milestones.set(campaign.id, [...milestones]);
    }
  }

  /** Test helper: seed a campaign with its milestones. */
  seed(campaign: Campaign, milestones: readonly Milestone[] = []): void {
    this.campaigns.set(campaign.id, campaign);
    this.milestones.set(campaign.id, [...milestones]);
  }

  /** Test helper: get all campaigns. */
  getAll(): Campaign[] {
    return [...this.campaigns.values()];
  }

  /** Test helper: clear all data. */
  clear(): void {
    this.campaigns.clear();
    this.milestones.clear();
  }
}
