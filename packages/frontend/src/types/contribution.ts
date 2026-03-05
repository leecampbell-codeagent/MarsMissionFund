/**
 * Contribution — as returned by POST /api/v1/contributions and GET /api/v1/contributions/:id
 * amountCents is a STRING (per G-024, monetary rule — never parse to number).
 */
export interface Contribution {
  readonly id: string;
  readonly campaignId: string;
  readonly amountCents: string; // BIGINT serialised as string
  readonly status: ContributionStatus;
  readonly transactionRef: string | null;
  readonly failureReason: string | null;
  readonly createdAt: string; // ISO 8601
}

export type ContributionStatus = 'pending_capture' | 'captured' | 'failed';

export interface CreateContributionInput {
  readonly campaignId: string;
  readonly amountCents: string; // Send as string per API contract
  readonly paymentToken: string;
}

/**
 * Display helper: converts cents string to formatted USD.
 * Uses Intl.NumberFormat — never manual formatting (frontend rule).
 */
export function formatContributionAmount(amountCents: string): string {
  const cents = parseInt(amountCents, 10);
  if (Number.isNaN(cents)) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}
