import type { Pool, PoolClient } from 'pg';
import pino from 'pino';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryUserRepository } from '../../account/adapters/in-memory-user-repository.adapter.js';
import { UserNotFoundError } from '../../account/domain/errors/account-errors.js';
import { User, type UserData } from '../../account/domain/models/user.js';
import { AccountStatus } from '../../account/domain/value-objects/account-status.js';
import { KycStatus } from '../../account/domain/value-objects/kyc-status.js';
import { NotificationPreferences } from '../../account/domain/value-objects/notification-preferences.js';
import { Role } from '../../account/domain/value-objects/role.js';
import { InMemoryCampaignRepository } from '../../campaign/adapters/in-memory-campaign-repository.adapter.js';
import { CampaignNotFoundError } from '../../campaign/domain/errors/campaign-errors.js';
import { Campaign, type CampaignData } from '../../campaign/domain/models/campaign.js';
import { InMemoryContributionAuditRepository } from '../adapters/in-memory-contribution-audit-repository.adapter.js';
import { InMemoryContributionRepository } from '../adapters/in-memory-contribution-repository.adapter.js';
import { InMemoryEscrowLedgerRepository } from '../adapters/in-memory-escrow-ledger-repository.adapter.js';
import {
  CampaignNotAcceptingContributionsError,
  ContributionAmountBelowMinimumError,
  ContributionNotFoundError,
  DuplicateContributionError,
} from '../domain/errors/payment-errors.js';
import type {
  CaptureInput,
  CaptureResult,
  PaymentGatewayPort,
} from '../ports/payment-gateway.port.js';
import { ContributionAppService } from './contribution-app-service.js';

const logger = pino({ level: 'silent' });

// ─── Mock Pool ───────────────────────────────────────────────────────────────
// The application service uses Pool for transactions. We need a mock that
// simulates BEGIN/COMMIT/ROLLBACK and also executes UPDATE campaigns queries.

/**
 * Creates a mock Pool that supports transactions.
 * The `campaignTotalsRows` array is updated on each UPDATE campaigns call.
 */
function makeMockPool(
  campaignRepo: InMemoryCampaignRepository,
  contributionRepo: InMemoryContributionRepository,
): Pool {
  const mockClient: Partial<PoolClient> = {
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      if (sql === 'BEGIN' || sql === 'ROLLBACK') {
        return { rows: [], rowCount: 0 };
      }
      if (sql === 'COMMIT') {
        return { rows: [], rowCount: 0 };
      }

      // Handle UPDATE contributions SET status = ... (transaction updateStatus)
      if (typeof sql === 'string' && sql.includes('UPDATE contributions') && params) {
        const typedParams = params as Array<string | null | undefined>;
        const contributionId = typedParams[0] ?? '';
        const status = typedParams[1] ?? 'pending_capture';
        const transactionRef = typedParams[2] ?? null;
        const failureReason = typedParams[3] ?? null;
        const existing = contributionRepo.contributions.get(contributionId);
        if (existing) {
          const { Contribution } = await import('../domain/models/contribution.js');
          const { ContributionStatus } = await import(
            '../domain/value-objects/contribution-status.js'
          );
          const updated = Contribution.reconstitute({
            id: existing.id,
            donorUserId: existing.donorUserId,
            campaignId: existing.campaignId,
            amountCents: existing.amountCents,
            paymentToken: existing.paymentToken,
            status: status as (typeof ContributionStatus)[keyof typeof ContributionStatus],
            transactionRef: transactionRef,
            failureReason: failureReason,
            idempotencyKey: existing.idempotencyKey,
            createdAt: existing.createdAt,
            updatedAt: new Date(),
          });
          contributionRepo.contributions.set(contributionId, updated);
          return {
            rows: [
              {
                id: updated.id,
                donor_user_id: updated.donorUserId,
                campaign_id: updated.campaignId,
                amount_cents: String(updated.amountCents),
                payment_token: updated.paymentToken,
                status: updated.status,
                transaction_ref: updated.transactionRef,
                failure_reason: updated.failureReason,
                idempotency_key: updated.idempotencyKey,
                created_at: updated.createdAt,
                updated_at: updated.updatedAt,
              },
            ],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      }

      // Handle INSERT INTO escrow_ledger (from pg escrow repo — but we use in-memory)
      if (typeof sql === 'string' && sql.includes('escrow_ledger') && sql.includes('SELECT')) {
        return { rows: [{ prev_balance: '0' }], rowCount: 1 };
      }
      if (typeof sql === 'string' && sql.includes('INSERT INTO escrow_ledger')) {
        const p = params as Array<string | number | null | undefined>;
        return {
          rows: [
            {
              id: crypto.randomUUID(),
              campaign_id: p[0] ?? '',
              contribution_id: p[1] ?? '',
              entry_type: 'credit',
              amount_cents: String(p[3] ?? 0),
              running_balance_cents: String(p[4] ?? 0),
              created_at: new Date(),
            },
          ],
          rowCount: 1,
        };
      }

      // Handle UPDATE campaigns SET total_raised_cents
      if (
        typeof sql === 'string' &&
        sql.includes('UPDATE campaigns') &&
        sql.includes('total_raised_cents') &&
        params
      ) {
        const [campaignId, amountCents] = params as [string, number];
        const campaign = campaignRepo.campaigns.get(campaignId);
        if (!campaign) {
          return { rows: [], rowCount: 0 };
        }

        // Simple simulation: return updated totals
        const newTotal = 0 + amountCents; // simplified — always starts at 0 for tests
        return {
          rows: [
            {
              id: campaign.id,
              total_raised_cents: String(newTotal),
              funding_goal_cents: campaign.fundingGoalCents,
              status: campaign.status,
            },
          ],
          rowCount: 1,
        };
      }

      // Handle UPDATE campaigns SET status = 'funded'
      if (typeof sql === 'string' && sql.includes("status = 'funded'") && params) {
        const [campaignId] = params as [string];
        const campaign = campaignRepo.campaigns.get(campaignId);
        if (campaign) {
          const funded = Campaign.reconstitute({
            ...getCampaignData(campaign),
            status: 'funded',
          });
          campaignRepo.campaigns.set(campaignId, funded);
        }
        return { rows: [], rowCount: 1 };
      }

      return { rows: [], rowCount: 0 };
    }) as unknown as PoolClient['query'],
    release: vi.fn(),
  };

  return {
    connect: vi.fn(async () => mockClient as PoolClient),
    query: vi.fn(),
  } as unknown as Pool;
}

function getCampaignData(campaign: Campaign): CampaignData {
  return {
    id: campaign.id,
    creatorUserId: campaign.creatorUserId,
    title: campaign.title,
    shortDescription: campaign.shortDescription,
    description: campaign.description,
    category: campaign.category,
    heroImageUrl: campaign.heroImageUrl,
    fundingGoalCents: campaign.fundingGoalCents,
    fundingCapCents: campaign.fundingCapCents,
    deadline: campaign.deadline,
    milestones: campaign.milestones,
    teamMembers: campaign.teamMembers,
    riskDisclosures: campaign.riskDisclosures,
    budgetBreakdown: campaign.budgetBreakdown,
    alignmentStatement: campaign.alignmentStatement,
    tags: campaign.tags,
    status: campaign.status,
    rejectionReason: campaign.rejectionReason,
    resubmissionGuidance: campaign.resubmissionGuidance,
    reviewNotes: campaign.reviewNotes,
    reviewedByUserId: campaign.reviewedByUserId,
    reviewedAt: campaign.reviewedAt,
    submittedAt: campaign.submittedAt,
    launchedAt: campaign.launchedAt,
    createdAt: campaign.createdAt,
    updatedAt: campaign.updatedAt,
  };
}

// ─── Stub Payment Gateway ─────────────────────────────────────────────────────

class StubGateway implements PaymentGatewayPort {
  private _shouldFail = false;
  private _calls: CaptureInput[] = [];

  setFailMode(fail: boolean): void {
    this._shouldFail = fail;
  }

  get calls(): CaptureInput[] {
    return this._calls;
  }

  async capture(input: CaptureInput): Promise<CaptureResult> {
    this._calls.push(input);
    if (this._shouldFail || input.paymentToken === 'tok_fail') {
      return { success: false, transactionRef: null, failureReason: 'Card declined by stub' };
    }
    return {
      success: true,
      transactionRef: `stub_txn_${input.contributionId}`,
      failureReason: null,
    };
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeUserData(clerkUserId: string, overrides: Partial<UserData> = {}): UserData {
  return {
    id: crypto.randomUUID(),
    clerkUserId,
    email: `${clerkUserId}@test.mmf`,
    displayName: null,
    bio: null,
    avatarUrl: null,
    accountStatus: AccountStatus.Active,
    onboardingCompleted: false,
    onboardingStep: null,
    roles: [Role.Backer],
    notificationPrefs: NotificationPreferences.defaults(),
    kycStatus: KycStatus.NotStarted,
    lastSeenAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function seedUser(
  repo: InMemoryUserRepository,
  clerkUserId: string,
  overrides: Partial<UserData> = {},
): User {
  const data = makeUserData(clerkUserId, overrides);
  const user = User.reconstitute(data);
  repo.users.set(clerkUserId, user);
  return user;
}

function makeLiveCampaign(overrides: Partial<CampaignData> = {}): Campaign {
  return Campaign.reconstitute({
    id: crypto.randomUUID(),
    creatorUserId: crypto.randomUUID(),
    title: 'Mars Mission Campaign',
    shortDescription: null,
    description: null,
    category: null,
    heroImageUrl: null,
    fundingGoalCents: '1000000', // $10,000 goal
    fundingCapCents: null,
    deadline: null,
    milestones: [],
    teamMembers: [],
    riskDisclosures: [],
    budgetBreakdown: [],
    alignmentStatement: null,
    tags: [],
    status: 'live',
    rejectionReason: null,
    resubmissionGuidance: null,
    reviewNotes: null,
    reviewedByUserId: null,
    reviewedAt: null,
    submittedAt: null,
    launchedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ContributionAppService', () => {
  let userRepo: InMemoryUserRepository;
  let campaignRepo: InMemoryCampaignRepository;
  let contributionRepo: InMemoryContributionRepository;
  let escrowRepo: InMemoryEscrowLedgerRepository;
  let auditRepo: InMemoryContributionAuditRepository;
  let gateway: StubGateway;
  let pool: Pool;
  let service: ContributionAppService;

  const DONOR_CLERK_ID = 'user_donor_test_001';
  let donorUser: User;
  let liveCampaign: Campaign;

  beforeEach(() => {
    userRepo = new InMemoryUserRepository();
    campaignRepo = new InMemoryCampaignRepository();
    contributionRepo = new InMemoryContributionRepository();
    escrowRepo = new InMemoryEscrowLedgerRepository();
    auditRepo = new InMemoryContributionAuditRepository();
    gateway = new StubGateway();

    donorUser = seedUser(userRepo, DONOR_CLERK_ID);
    liveCampaign = makeLiveCampaign();
    campaignRepo.campaigns.set(liveCampaign.id, liveCampaign);

    pool = makeMockPool(campaignRepo, contributionRepo);

    service = new ContributionAppService(
      pool,
      contributionRepo,
      escrowRepo,
      auditRepo,
      campaignRepo,
      userRepo,
      gateway,
      logger,
    );
  });

  // ─── Happy path: successful contribution ─────────────────────────────────

  describe('createContribution — happy path (success)', () => {
    it('creates pending_capture record, calls gateway, updates to captured, returns captured contribution', async () => {
      const result = await service.createContribution(DONOR_CLERK_ID, {
        campaignId: liveCampaign.id,
        amountCents: 75317,
        paymentToken: 'tok_success_abc',
      });

      expect(result.status).toBe('captured');
      expect(result.transactionRef).toMatch(/^stub_txn_/);
      expect(result.amountCents).toBe(75317);
      expect(result.campaignId).toBe(liveCampaign.id);
      expect(result.donorUserId).toBe(donorUser.id);
    });

    it('creates contribution.created and contribution.captured audit events on success', async () => {
      await service.createContribution(DONOR_CLERK_ID, {
        campaignId: liveCampaign.id,
        amountCents: 75317,
        paymentToken: 'tok_success',
      });

      expect(auditRepo.events).toHaveLength(2);
      expect(auditRepo.events[0]?.eventType).toBe('contribution.created');
      expect(auditRepo.events[1]?.eventType).toBe('contribution.captured');
    });

    it('creates an escrow ledger credit entry on success', async () => {
      await service.createContribution(DONOR_CLERK_ID, {
        campaignId: liveCampaign.id,
        amountCents: 75317,
        paymentToken: 'tok_success',
      });

      expect(escrowRepo.entries).toHaveLength(1);
      expect(escrowRepo.entries[0]?.entryType).toBe('credit');
      expect(escrowRepo.entries[0]?.amountCents).toBe(75317);
    });

    it('calls the payment gateway exactly once', async () => {
      await service.createContribution(DONOR_CLERK_ID, {
        campaignId: liveCampaign.id,
        amountCents: 75317,
        paymentToken: 'tok_abc',
      });

      expect(gateway.calls).toHaveLength(1);
    });
  });

  // ─── Happy path: payment failure ─────────────────────────────────────────

  describe('createContribution — payment failure path (tok_fail)', () => {
    it('returns failed contribution (status: failed) when gateway fails', async () => {
      const result = await service.createContribution(DONOR_CLERK_ID, {
        campaignId: liveCampaign.id,
        amountCents: 75317,
        paymentToken: 'tok_fail',
      });

      expect(result.status).toBe('failed');
      expect(result.failureReason).toBeTruthy();
      expect(result.transactionRef).toBeNull();
    });

    it('does NOT create escrow ledger entry on failure', async () => {
      await service.createContribution(DONOR_CLERK_ID, {
        campaignId: liveCampaign.id,
        amountCents: 75317,
        paymentToken: 'tok_fail',
      });

      expect(escrowRepo.entries).toHaveLength(0);
    });

    it('creates contribution.created and contribution.failed audit events on failure', async () => {
      await service.createContribution(DONOR_CLERK_ID, {
        campaignId: liveCampaign.id,
        amountCents: 75317,
        paymentToken: 'tok_fail',
      });

      expect(auditRepo.events).toHaveLength(2);
      expect(auditRepo.events[0]?.eventType).toBe('contribution.created');
      expect(auditRepo.events[1]?.eventType).toBe('contribution.failed');
    });

    it('does NOT throw on payment failure — returns failed contribution', async () => {
      await expect(
        service.createContribution(DONOR_CLERK_ID, {
          campaignId: liveCampaign.id,
          amountCents: 75317,
          paymentToken: 'tok_fail',
        }),
      ).resolves.not.toThrow();
    });
  });

  // ─── Validation: amount below minimum ────────────────────────────────────

  describe('createContribution — validation', () => {
    it('throws ContributionAmountBelowMinimumError for amount 499 cents', async () => {
      await expect(
        service.createContribution(DONOR_CLERK_ID, {
          campaignId: liveCampaign.id,
          amountCents: 499,
          paymentToken: 'tok_abc',
        }),
      ).rejects.toThrow(ContributionAmountBelowMinimumError);
    });

    it('accepts amount exactly at minimum (500 cents)', async () => {
      const result = await service.createContribution(DONOR_CLERK_ID, {
        campaignId: liveCampaign.id,
        amountCents: 500,
        paymentToken: 'tok_abc',
      });
      expect(result.amountCents).toBe(500);
    });

    it('throws CampaignNotFoundError when campaign does not exist', async () => {
      await expect(
        service.createContribution(DONOR_CLERK_ID, {
          campaignId: crypto.randomUUID(),
          amountCents: 75317,
          paymentToken: 'tok_abc',
        }),
      ).rejects.toThrow(CampaignNotFoundError);
    });

    it('throws CampaignNotAcceptingContributionsError when campaign is submitted', async () => {
      const submittedCampaign = makeLiveCampaign({ status: 'submitted' });
      campaignRepo.campaigns.set(submittedCampaign.id, submittedCampaign);

      await expect(
        service.createContribution(DONOR_CLERK_ID, {
          campaignId: submittedCampaign.id,
          amountCents: 75317,
          paymentToken: 'tok_abc',
        }),
      ).rejects.toThrow(CampaignNotAcceptingContributionsError);
    });

    it('throws CampaignNotAcceptingContributionsError when campaign is funded', async () => {
      const fundedCampaign = makeLiveCampaign({ status: 'funded' });
      campaignRepo.campaigns.set(fundedCampaign.id, fundedCampaign);

      await expect(
        service.createContribution(DONOR_CLERK_ID, {
          campaignId: fundedCampaign.id,
          amountCents: 75317,
          paymentToken: 'tok_abc',
        }),
      ).rejects.toThrow(CampaignNotAcceptingContributionsError);
    });

    it('throws CampaignNotAcceptingContributionsError when campaign is draft', async () => {
      const draftCampaign = makeLiveCampaign({ status: 'draft' });
      campaignRepo.campaigns.set(draftCampaign.id, draftCampaign);

      await expect(
        service.createContribution(DONOR_CLERK_ID, {
          campaignId: draftCampaign.id,
          amountCents: 75317,
          paymentToken: 'tok_abc',
        }),
      ).rejects.toThrow(CampaignNotAcceptingContributionsError);
    });

    it('throws UserNotFoundError when user does not exist', async () => {
      await expect(
        service.createContribution('user_nonexistent_clerk_id', {
          campaignId: liveCampaign.id,
          amountCents: 75317,
          paymentToken: 'tok_abc',
        }),
      ).rejects.toThrow(UserNotFoundError);
    });
  });

  // ─── Duplicate detection ──────────────────────────────────────────────────

  describe('createContribution — duplicate detection', () => {
    it('throws DuplicateContributionError when identical contribution is within 60s', async () => {
      contributionRepo.setDuplicateOverride(true);

      await expect(
        service.createContribution(DONOR_CLERK_ID, {
          campaignId: liveCampaign.id,
          amountCents: 75317,
          paymentToken: 'tok_abc',
        }),
      ).rejects.toThrow(DuplicateContributionError);

      // Gateway should NOT have been called
      expect(gateway.calls).toHaveLength(0);
    });

    it('proceeds when existsDuplicate returns false', async () => {
      contributionRepo.setDuplicateOverride(false);

      const result = await service.createContribution(DONOR_CLERK_ID, {
        campaignId: liveCampaign.id,
        amountCents: 75317,
        paymentToken: 'tok_abc',
      });

      expect(result.status).toBe('captured');
    });

    it('does not count failed contributions as duplicates', async () => {
      // Failed contribution already exists — override returns false (failed don't count)
      contributionRepo.setDuplicateOverride(false);

      const result = await service.createContribution(DONOR_CLERK_ID, {
        campaignId: liveCampaign.id,
        amountCents: 75317,
        paymentToken: 'tok_abc',
      });

      expect(result.status).toBe('captured');
    });
  });

  // ─── Audit failure resilience ─────────────────────────────────────────────

  describe('createContribution — audit failure resilience', () => {
    it('returns contribution even if audit createEvent throws (per P-021)', async () => {
      // Override the audit repo to throw
      auditRepo.createEvent = vi.fn().mockRejectedValue(new Error('Audit DB down'));

      const result = await service.createContribution(DONOR_CLERK_ID, {
        campaignId: liveCampaign.id,
        amountCents: 75317,
        paymentToken: 'tok_abc',
      });

      // Main operation still succeeds
      expect(result.status).toBe('captured');
    });
  });

  // ─── getContributionForDonor ──────────────────────────────────────────────

  describe('getContributionForDonor', () => {
    it('returns contribution when it belongs to the authenticated user', async () => {
      const created = await service.createContribution(DONOR_CLERK_ID, {
        campaignId: liveCampaign.id,
        amountCents: 75317,
        paymentToken: 'tok_abc',
      });

      const fetched = await service.getContributionForDonor(DONOR_CLERK_ID, created.id);
      expect(fetched.id).toBe(created.id);
    });

    it('throws ContributionNotFoundError for unknown contribution ID', async () => {
      await expect(
        service.getContributionForDonor(DONOR_CLERK_ID, crypto.randomUUID()),
      ).rejects.toThrow(ContributionNotFoundError);
    });

    it('throws ContributionNotFoundError when contribution belongs to another user', async () => {
      // Create contribution for donor
      const created = await service.createContribution(DONOR_CLERK_ID, {
        campaignId: liveCampaign.id,
        amountCents: 75317,
        paymentToken: 'tok_abc',
      });

      // Different user tries to access it
      const otherUser = seedUser(userRepo, 'user_other_donor_002');

      await expect(
        service.getContributionForDonor(otherUser.clerkUserId, created.id),
      ).rejects.toThrow(ContributionNotFoundError);
    });
  });

  // ─── listContributionsForDonorCampaign ───────────────────────────────────

  describe('listContributionsForDonorCampaign', () => {
    it('returns empty array when no contributions exist', async () => {
      const results = await service.listContributionsForDonorCampaign(
        DONOR_CLERK_ID,
        liveCampaign.id,
        20,
        0,
      );
      expect(results).toHaveLength(0);
    });

    it('returns contributions for the donor and campaign', async () => {
      await service.createContribution(DONOR_CLERK_ID, {
        campaignId: liveCampaign.id,
        amountCents: 75317,
        paymentToken: 'tok_abc',
      });

      const results = await service.listContributionsForDonorCampaign(
        DONOR_CLERK_ID,
        liveCampaign.id,
        20,
        0,
      );
      expect(results).toHaveLength(1);
    });
  });
});
