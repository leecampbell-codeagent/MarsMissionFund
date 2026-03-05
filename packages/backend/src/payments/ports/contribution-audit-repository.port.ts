export interface ContributionAuditEvent {
  readonly id: string;
  readonly contributionId: string;
  readonly campaignId: string;
  readonly donorUserId: string;
  readonly previousStatus: string | null;
  readonly newStatus: string;
  readonly amountCents: number;
  readonly eventType: string;
  readonly createdAt: Date;
}

export interface CreateAuditEventInput {
  readonly contributionId: string;
  readonly campaignId: string;
  readonly donorUserId: string;
  readonly previousStatus: string | null;
  readonly newStatus: string;
  readonly amountCents: number;
  readonly eventType: 'contribution.created' | 'contribution.captured' | 'contribution.failed';
}

export interface ContributionAuditRepository {
  createEvent(input: CreateAuditEventInput): Promise<ContributionAuditEvent>;
}
