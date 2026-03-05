import type { KycStatus } from '../../account/domain/value-objects/kyc-status.js';

export interface KycAuditEvent {
  readonly id: string;
  readonly userId: string | null;
  readonly actorClerkUserId: string;
  readonly action: 'kyc.status.change';
  readonly previousStatus: KycStatus | null;
  readonly newStatus: KycStatus;
  readonly triggerReason: string | null;
  readonly metadata: Record<string, unknown> | null;
  readonly createdAt: Date;
}

export interface CreateKycAuditEventInput {
  readonly userId: string;
  readonly actorClerkUserId: string;
  readonly action: 'kyc.status.change';
  readonly previousStatus: KycStatus | null;
  readonly newStatus: KycStatus;
  readonly triggerReason: string | null;
  readonly metadata?: Record<string, unknown>;
}

export interface KycAuditRepositoryPort {
  createEvent(input: CreateKycAuditEventInput): Promise<KycAuditEvent>;
  findByUserId(userId: string): Promise<KycAuditEvent[]>;
}
