import { InvalidEscrowEntryError } from './payment-errors.js';

export type EscrowEntryType =
  | 'contribution'
  | 'disbursement'
  | 'refund'
  | 'interest_credit'
  | 'interest_debit';

const VALID_ENTRY_TYPES: readonly EscrowEntryType[] = [
  'contribution',
  'disbursement',
  'refund',
  'interest_credit',
  'interest_debit',
];

interface EscrowLedgerEntryProps {
  readonly id: string;
  readonly campaignId: string;
  readonly entryType: EscrowEntryType;
  readonly amountCents: number;
  readonly contributionId: string | null;
  readonly disbursementId: string | null;
  readonly description: string | null;
  readonly createdAt: Date;
}

export interface CreateEscrowLedgerEntryInput {
  readonly campaignId: string;
  readonly entryType: EscrowEntryType;
  readonly amountCents: number;
  readonly contributionId?: string | null;
  readonly disbursementId?: string | null;
  readonly description?: string | null;
}

export class EscrowLedgerEntry {
  private constructor(private readonly props: EscrowLedgerEntryProps) {}

  /** Creates a new ledger entry with full validation. */
  static create(input: CreateEscrowLedgerEntryInput): EscrowLedgerEntry {
    if (!input.campaignId || input.campaignId.trim().length === 0) {
      throw new InvalidEscrowEntryError('campaignId must be a non-empty string.');
    }

    if (!VALID_ENTRY_TYPES.includes(input.entryType)) {
      throw new InvalidEscrowEntryError(`Invalid entry type: '${input.entryType}'.`);
    }

    if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
      throw new InvalidEscrowEntryError('amountCents must be a positive integer.');
    }

    return new EscrowLedgerEntry({
      id: crypto.randomUUID(),
      campaignId: input.campaignId,
      entryType: input.entryType,
      amountCents: input.amountCents,
      contributionId: input.contributionId ?? null,
      disbursementId: input.disbursementId ?? null,
      description: input.description ?? null,
      createdAt: new Date(),
    });
  }

  /** Reconstitutes from persistence — no validation. */
  static reconstitute(props: EscrowLedgerEntryProps): EscrowLedgerEntry {
    return new EscrowLedgerEntry(props);
  }

  get id(): string {
    return this.props.id;
  }

  get campaignId(): string {
    return this.props.campaignId;
  }

  get entryType(): EscrowEntryType {
    return this.props.entryType;
  }

  get amountCents(): number {
    return this.props.amountCents;
  }

  get contributionId(): string | null {
    return this.props.contributionId;
  }

  get disbursementId(): string | null {
    return this.props.disbursementId;
  }

  get description(): string | null {
    return this.props.description;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }
}
