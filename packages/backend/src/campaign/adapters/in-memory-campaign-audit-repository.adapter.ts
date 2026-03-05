import type { CampaignStatus } from '../domain/value-objects/campaign-status.js';
import type {
  CampaignAuditEvent,
  CampaignAuditRepository,
  CreateCampaignAuditEventInput,
} from '../ports/campaign-audit-repository.port.js';

/**
 * In-memory implementation for tests.
 * Exposed `events` array allows test assertions.
 */
export class InMemoryCampaignAuditRepository implements CampaignAuditRepository {
  readonly events: CampaignAuditEvent[] = [];

  async createEvent(input: CreateCampaignAuditEventInput): Promise<CampaignAuditEvent> {
    const event: CampaignAuditEvent = {
      id: crypto.randomUUID(),
      campaignId: input.campaignId,
      actorUserId: input.actorUserId,
      actorClerkUserId: input.actorClerkUserId,
      action: input.action,
      previousStatus: (input.previousStatus as CampaignStatus) ?? null,
      newStatus: input.newStatus as CampaignStatus,
      rationale: input.rationale ?? null,
      metadata: input.metadata ?? null,
      createdAt: new Date(),
    };

    this.events.push(event);
    return event;
  }

  async findByCampaignId(campaignId: string): Promise<CampaignAuditEvent[]> {
    return this.events
      .filter((e) => e.campaignId === campaignId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }
}
