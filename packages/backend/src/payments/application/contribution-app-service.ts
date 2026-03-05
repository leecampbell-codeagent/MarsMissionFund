import type { Pool, PoolClient } from 'pg';
import type { Logger } from 'pino';
import { UserNotFoundError } from '../../account/domain/errors/account-errors.js';
import type { UserRepository } from '../../account/ports/user-repository.port.js';
import { CampaignNotFoundError } from '../../campaign/domain/errors/campaign-errors.js';
import type { CampaignRepository } from '../../campaign/ports/campaign-repository.port.js';
import {
  CampaignNotAcceptingContributionsError,
  ContributionNotFoundError,
  DuplicateContributionError,
} from '../domain/errors/payment-errors.js';
import { Contribution } from '../domain/models/contribution.js';
import type { ContributionAuditRepository } from '../ports/contribution-audit-repository.port.js';
import type { ContributionRepository } from '../ports/contribution-repository.port.js';
import type { EscrowLedgerRepository } from '../ports/escrow-ledger-repository.port.js';
import type { PaymentGatewayPort } from '../ports/payment-gateway.port.js';

interface CampaignTotalsRow {
  id: string;
  total_raised_cents: string; // BIGINT as string
  funding_goal_cents: string | null; // BIGINT as string
  status: string;
}

export class ContributionAppService {
  constructor(
    private readonly pool: Pool, // For transaction management
    private readonly contributionRepository: ContributionRepository,
    private readonly escrowLedgerRepository: EscrowLedgerRepository,
    private readonly contributionAuditRepository: ContributionAuditRepository,
    private readonly campaignRepository: CampaignRepository, // Cross-context read (P-023)
    private readonly userRepository: UserRepository, // Cross-context read (P-023)
    private readonly paymentGateway: PaymentGatewayPort,
    private readonly logger: Logger,
  ) {}

  /**
   * Creates a new contribution and processes payment.
   * Step-by-step logic follows the spec exactly (feat-005-spec-api.md §2).
   */
  async createContribution(
    clerkUserId: string,
    input: {
      campaignId: string;
      amountCents: number;
      paymentToken: string; // NEVER LOG
    },
  ): Promise<Contribution> {
    // Step 1: Resolve clerkUserId → internal user record
    const user = await this.userRepository.findByClerkUserId(clerkUserId);
    if (!user) {
      throw new UserNotFoundError(clerkUserId);
    }

    // Step 2: Validate campaign exists and is 'live'
    const campaign = await this.campaignRepository.findById(input.campaignId);
    if (!campaign) {
      throw new CampaignNotFoundError();
    }
    if (campaign.status !== 'live') {
      throw new CampaignNotAcceptingContributionsError(campaign.status);
    }

    // Step 3: Duplicate check (60-second window)
    const isDuplicate = await this.contributionRepository.existsDuplicate(
      user.id,
      input.campaignId,
      input.amountCents,
      60,
    );
    if (isDuplicate) {
      throw new DuplicateContributionError();
    }

    // Step 4: Create contribution domain entity
    const contribution = Contribution.create({
      donorUserId: user.id,
      campaignId: input.campaignId,
      amountCents: input.amountCents,
      paymentToken: input.paymentToken, // NEVER LOG
    });

    // Step 5: Persist contribution as 'pending_capture'
    const savedContribution = await this.contributionRepository.save(contribution);
    // At this point, an immutable record of intent exists — crash-safe

    // Step 6: Emit 'contribution.created' audit event (best-effort AFTER save — per G-019)
    try {
      await this.contributionAuditRepository.createEvent({
        contributionId: savedContribution.id,
        campaignId: savedContribution.campaignId,
        donorUserId: savedContribution.donorUserId,
        previousStatus: null,
        newStatus: 'pending_capture',
        amountCents: savedContribution.amountCents,
        eventType: 'contribution.created',
      });
    } catch (auditErr) {
      this.logger.error({ err: auditErr }, 'Failed to write contribution.created audit event');
    }

    // Step 7: Call payment gateway
    // NOTE: paymentToken MUST NOT appear in log context
    this.logger.info(
      { contributionId: savedContribution.id, campaignId: savedContribution.campaignId },
      'Calling payment gateway for contribution',
    );
    const result = await this.paymentGateway.capture({
      contributionId: savedContribution.id,
      amountCents: savedContribution.amountCents,
      paymentToken: savedContribution.paymentToken, // NEVER LOG
      campaignId: savedContribution.campaignId,
      donorUserId: savedContribution.donorUserId,
    });

    // Step 8a: FAILURE PATH
    if (!result.success) {
      const failedContribution = await this.contributionRepository.updateStatus(
        savedContribution.id,
        'failed',
        null,
        result.failureReason,
      );

      // Emit 'contribution.failed' audit event (best-effort)
      try {
        await this.contributionAuditRepository.createEvent({
          contributionId: savedContribution.id,
          campaignId: savedContribution.campaignId,
          donorUserId: savedContribution.donorUserId,
          previousStatus: 'pending_capture',
          newStatus: 'failed',
          amountCents: savedContribution.amountCents,
          eventType: 'contribution.failed',
        });
      } catch (auditErr) {
        this.logger.error({ err: auditErr }, 'Failed to write contribution.failed audit event');
      }

      // Return failed contribution — do NOT throw, audit trail must be preserved
      return failedContribution;
    }

    // Step 8b: SUCCESS PATH — atomic DB transaction
    const client: PoolClient = await this.pool.connect();
    let capturedContribution: Contribution;
    try {
      await client.query('BEGIN');

      // a. Update contribution status to 'captured'
      capturedContribution = await this.contributionRepository.updateStatus(
        savedContribution.id,
        'captured',
        result.transactionRef,
        null,
        client,
      );

      // b. Create escrow ledger entry
      await this.escrowLedgerRepository.createEntry(
        {
          campaignId: savedContribution.campaignId,
          contributionId: savedContribution.id,
          entryType: 'credit',
          amountCents: savedContribution.amountCents,
        },
        client,
      );

      // c. Update campaign totals
      const campaignTotalsResult = await client.query<CampaignTotalsRow>(
        `UPDATE campaigns
         SET total_raised_cents = total_raised_cents + $2,
             contributor_count  = contributor_count + 1,
             updated_at         = NOW()
         WHERE id = $1
         RETURNING id, total_raised_cents, funding_goal_cents, status`,
        [savedContribution.campaignId, savedContribution.amountCents],
      );

      const campaignRow = campaignTotalsResult.rows[0];
      if (!campaignRow) {
        throw new Error(`Campaign ${savedContribution.campaignId} not found during totals update`);
      }

      // d. Auto-transition to funded if goal reached
      const totalRaisedCents = parseInt(campaignRow.total_raised_cents, 10);
      const fundingGoalCents =
        campaignRow.funding_goal_cents !== null
          ? parseInt(campaignRow.funding_goal_cents, 10)
          : null;

      if (
        fundingGoalCents !== null &&
        totalRaisedCents >= fundingGoalCents &&
        campaignRow.status === 'live'
      ) {
        await client.query(
          `UPDATE campaigns SET status = 'funded', updated_at = NOW()
           WHERE id = $1 AND status = 'live'`,
          [savedContribution.campaignId],
        );
        this.logger.info(
          { campaignId: savedContribution.campaignId },
          'Campaign auto-transitioned to funded',
        );
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    // Emit 'contribution.captured' audit event (best-effort, AFTER commit — per G-019)
    try {
      await this.contributionAuditRepository.createEvent({
        contributionId: savedContribution.id,
        campaignId: savedContribution.campaignId,
        donorUserId: savedContribution.donorUserId,
        previousStatus: 'pending_capture',
        newStatus: 'captured',
        amountCents: savedContribution.amountCents,
        eventType: 'contribution.captured',
      });
    } catch (auditErr) {
      this.logger.error({ err: auditErr }, 'Failed to write contribution.captured audit event');
    }

    return capturedContribution;
  }

  /**
   * Fetches a contribution by ID, scoped to the authenticated donor.
   * Returns ContributionNotFoundError if not found or belongs to another user.
   */
  async getContributionForDonor(
    clerkUserId: string,
    contributionId: string,
  ): Promise<Contribution> {
    const user = await this.userRepository.findByClerkUserId(clerkUserId);
    if (!user) {
      throw new UserNotFoundError(clerkUserId);
    }

    const contribution = await this.contributionRepository.findByIdForDonor(
      contributionId,
      user.id,
    );
    if (!contribution) {
      // Do NOT reveal if it belongs to another user — return not found either way
      throw new ContributionNotFoundError();
    }

    return contribution;
  }

  /**
   * Lists contributions for a specific donor on a specific campaign (paginated).
   */
  async listContributionsForDonorCampaign(
    clerkUserId: string,
    campaignId: string,
    limit: number,
    offset: number,
  ): Promise<Contribution[]> {
    const user = await this.userRepository.findByClerkUserId(clerkUserId);
    if (!user) {
      throw new UserNotFoundError(clerkUserId);
    }

    return this.contributionRepository.listByDonorForCampaign(user.id, campaignId, limit, offset);
  }
}
