import { describe, expect, it } from 'vitest';
import { EscrowLedgerEntry, type EscrowEntryType } from '../escrow-ledger-entry.js';
import { InvalidEscrowEntryError } from '../payment-errors.js';

describe('EscrowLedgerEntry.create', () => {
  const validEntryTypes: EscrowEntryType[] = [
    'contribution',
    'disbursement',
    'refund',
    'interest_credit',
    'interest_debit',
  ];

  validEntryTypes.forEach((entryType) => {
    it(`creates an entry with valid entryType '${entryType}'`, () => {
      const entry = EscrowLedgerEntry.create({
        campaignId: 'campaign-uuid-001',
        entryType,
        amountCents: 250099,
      });

      expect(entry.id).toBeDefined();
      expect(entry.campaignId).toBe('campaign-uuid-001');
      expect(entry.entryType).toBe(entryType);
      expect(entry.amountCents).toBe(250099);
      expect(entry.contributionId).toBeNull();
      expect(entry.disbursementId).toBeNull();
      expect(entry.description).toBeNull();
      expect(entry.createdAt).toBeInstanceOf(Date);
    });
  });

  it('creates an entry with optional fields', () => {
    const entry = EscrowLedgerEntry.create({
      campaignId: 'campaign-uuid-001',
      entryType: 'contribution',
      amountCents: 250099,
      contributionId: 'contrib-uuid-001',
      description: 'Contribution captured',
    });

    expect(entry.contributionId).toBe('contrib-uuid-001');
    expect(entry.description).toBe('Contribution captured');
    expect(entry.disbursementId).toBeNull();
  });

  it('rejects zero amountCents with InvalidEscrowEntryError', () => {
    expect(() =>
      EscrowLedgerEntry.create({
        campaignId: 'campaign-uuid-001',
        entryType: 'contribution',
        amountCents: 0,
      }),
    ).toThrow(InvalidEscrowEntryError);
  });

  it('rejects negative amountCents with InvalidEscrowEntryError', () => {
    expect(() =>
      EscrowLedgerEntry.create({
        campaignId: 'campaign-uuid-001',
        entryType: 'contribution',
        amountCents: -100,
      }),
    ).toThrow(InvalidEscrowEntryError);
  });

  it('rejects non-integer amountCents with InvalidEscrowEntryError', () => {
    expect(() =>
      EscrowLedgerEntry.create({
        campaignId: 'campaign-uuid-001',
        entryType: 'contribution',
        amountCents: 10.5,
      }),
    ).toThrow(InvalidEscrowEntryError);
  });

  it('rejects invalid entryType with InvalidEscrowEntryError', () => {
    expect(() =>
      EscrowLedgerEntry.create({
        campaignId: 'campaign-uuid-001',
        entryType: 'invalid_type' as EscrowEntryType,
        amountCents: 250099,
      }),
    ).toThrow(InvalidEscrowEntryError);
  });

  it('rejects empty campaignId with InvalidEscrowEntryError', () => {
    expect(() =>
      EscrowLedgerEntry.create({
        campaignId: '',
        entryType: 'contribution',
        amountCents: 250099,
      }),
    ).toThrow(InvalidEscrowEntryError);
  });
});
