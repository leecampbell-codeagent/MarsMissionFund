import type { Contribution } from '../domain/models/contribution.js';

export interface SerializedContribution {
  readonly id: string;
  readonly campaignId: string;
  readonly amountCents: string; // BIGINT as string (G-024, monetary rule)
  readonly status: string;
  readonly transactionRef: string | null;
  readonly failureReason: string | null;
  readonly createdAt: string; // ISO 8601
}

export function serializeContribution(contribution: Contribution): SerializedContribution {
  return {
    id: contribution.id,
    campaignId: contribution.campaignId,
    amountCents: contribution.amountCents.toString(), // number → string per monetary rule
    status: contribution.status,
    transactionRef: contribution.transactionRef,
    failureReason: contribution.failureReason,
    createdAt: contribution.createdAt.toISOString(),
  };
}
