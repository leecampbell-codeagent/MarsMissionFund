import type {
  ContributionAuditEvent,
  ContributionAuditRepository,
  CreateAuditEventInput,
} from '../ports/contribution-audit-repository.port.js';

/**
 * In-memory implementation for tests.
 * Exposed `events` array allows test assertions.
 */
export class InMemoryContributionAuditRepository implements ContributionAuditRepository {
  readonly events: ContributionAuditEvent[] = [];

  async createEvent(input: CreateAuditEventInput): Promise<ContributionAuditEvent> {
    const event: ContributionAuditEvent = {
      id: crypto.randomUUID(),
      contributionId: input.contributionId,
      campaignId: input.campaignId,
      donorUserId: input.donorUserId,
      previousStatus: input.previousStatus,
      newStatus: input.newStatus,
      amountCents: input.amountCents,
      eventType: input.eventType,
      createdAt: new Date(),
    };
    this.events.push(event);
    return event;
  }
}
