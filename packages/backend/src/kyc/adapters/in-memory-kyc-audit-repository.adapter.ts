import type {
  CreateKycAuditEventInput,
  KycAuditEvent,
  KycAuditRepositoryPort,
} from '../ports/kyc-audit-repository.port.js';

export class InMemoryKycAuditRepository implements KycAuditRepositoryPort {
  readonly events: KycAuditEvent[] = [];

  async createEvent(input: CreateKycAuditEventInput): Promise<KycAuditEvent> {
    const event: KycAuditEvent = {
      id: crypto.randomUUID(),
      userId: input.userId,
      actorClerkUserId: input.actorClerkUserId,
      action: input.action,
      previousStatus: input.previousStatus,
      newStatus: input.newStatus,
      triggerReason: input.triggerReason,
      metadata: input.metadata ?? null,
      createdAt: new Date(),
    };
    this.events.push(event);
    return event;
  }

  async findByUserId(userId: string): Promise<KycAuditEvent[]> {
    return this.events
      .filter((e) => e.userId === userId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }
}
