import type { Logger } from 'pino';
import type { EventStorePort } from '../../shared/ports/event-store-port.js';
import { Campaign } from '../domain/campaign.js';
import type { CreateCampaignInput, UpdateCampaignInput } from '../domain/campaign.js';
import {
  CampaignNotFoundError,
  InsufficientRoleError,
  KycRequiredError,
} from '../domain/errors.js';
import { Milestone } from '../domain/milestone.js';
import type { CreateMilestoneInput } from '../domain/milestone.js';
import type { CampaignRepository } from '../ports/campaign-repository.js';
import type { KycStatusPort } from '../ports/kyc-status-port.js';

const CAMPAIGN_EVENT_TYPES = {
  DRAFT_CREATED: 'campaign.draft_created',
  DRAFT_UPDATED: 'campaign.draft_updated',
  SUBMITTED: 'campaign.submitted',
  REVIEW_STARTED: 'campaign.review_started',
  APPROVED: 'campaign.approved',
  REJECTED: 'campaign.rejected',
  REVIEW_RECUSED: 'campaign.review_recused',
  RETURNED_TO_DRAFT: 'campaign.returned_to_draft',
} as const;

export interface MilestoneInput {
  readonly title?: string | null;
  readonly description?: string | null;
  readonly targetDate?: string | null; // ISO date string
  readonly fundingPercentage?: number | null;
  readonly verificationCriteria?: string | null;
}

export interface CreateCampaignServiceInput {
  readonly title: string;
  readonly category: string;
  readonly minFundingTargetCents: number;
  readonly maxFundingCapCents: number;
  readonly summary?: string | null;
  readonly description?: string | null;
  readonly marsAlignmentStatement?: string | null;
  readonly deadline?: string | null; // ISO date string
  readonly budgetBreakdown?: string | null;
  readonly teamInfo?: string | null;
  readonly riskDisclosures?: string | null;
  readonly heroImageUrl?: string | null;
  readonly milestones?: readonly MilestoneInput[];
}

export interface UpdateCampaignServiceInput {
  readonly title?: string | null;
  readonly summary?: string | null;
  readonly description?: string | null;
  readonly marsAlignmentStatement?: string | null;
  readonly category?: string | null;
  readonly minFundingTargetCents?: number | null;
  readonly maxFundingCapCents?: number | null;
  readonly deadline?: string | null;
  readonly budgetBreakdown?: string | null;
  readonly teamInfo?: string | null;
  readonly riskDisclosures?: string | null;
  readonly heroImageUrl?: string | null;
  readonly milestones?: readonly MilestoneInput[];
}

export interface MilestoneResult {
  readonly id: string;
  readonly campaignId: string;
  readonly title: string | null;
  readonly description: string | null;
  readonly targetDate: Date | null;
  readonly fundingPercentage: number | null;
  readonly verificationCriteria: string | null;
  readonly status: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CampaignResult {
  readonly id: string;
  readonly creatorId: string;
  readonly title: string;
  readonly summary: string | null;
  readonly description: string | null;
  readonly marsAlignmentStatement: string | null;
  readonly category: string;
  readonly status: string;
  readonly minFundingTargetCents: number;
  readonly maxFundingCapCents: number;
  readonly deadline: Date | null;
  readonly budgetBreakdown: string | null;
  readonly teamInfo: string | null;
  readonly riskDisclosures: string | null;
  readonly heroImageUrl: string | null;
  readonly reviewerId: string | null;
  readonly reviewerComment: string | null;
  readonly reviewedAt: Date | null;
  readonly milestones: readonly MilestoneResult[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export class CampaignAppService {
  constructor(
    private readonly campaignRepository: CampaignRepository,
    private readonly kycStatusPort: KycStatusPort,
    private readonly eventStore: EventStorePort,
    private readonly logger: Logger,
  ) {}

  async createDraft(userId: string, input: CreateCampaignServiceInput): Promise<CampaignResult> {
    const createInput: CreateCampaignInput = {
      creatorId: userId,
      title: input.title,
      // biome-ignore lint/suspicious/noExplicitAny: type checked at API layer
      category: input.category as any,
      minFundingTargetCents: input.minFundingTargetCents,
      maxFundingCapCents: input.maxFundingCapCents,
      summary: input.summary,
      description: input.description,
      marsAlignmentStatement: input.marsAlignmentStatement,
      deadline: input.deadline ? new Date(input.deadline) : null,
      budgetBreakdown: input.budgetBreakdown,
      teamInfo: input.teamInfo,
      riskDisclosures: input.riskDisclosures,
      heroImageUrl: input.heroImageUrl,
    };

    const campaign = Campaign.create(createInput);

    const milestones = this.buildMilestones(campaign.id, input.milestones ?? []);

    await this.campaignRepository.save(campaign, milestones);

    const seqNum = await this.eventStore.getNextSequenceNumber(campaign.id);
    await this.eventStore.append({
      eventType: CAMPAIGN_EVENT_TYPES.DRAFT_CREATED,
      aggregateId: campaign.id,
      aggregateType: 'campaign',
      sequenceNumber: seqNum,
      correlationId: crypto.randomUUID(),
      sourceService: 'campaign-service',
      payload: { campaignId: campaign.id, creatorId: userId, title: campaign.title },
    });

    this.logger.info({ campaignId: campaign.id, creatorId: userId }, 'Campaign draft created');

    return this.toResult(campaign, milestones);
  }

  async updateDraft(
    userId: string,
    campaignId: string,
    input: UpdateCampaignServiceInput,
  ): Promise<CampaignResult> {
    const record = await this.campaignRepository.findById(campaignId);
    if (!record || record.campaign.creatorId !== userId) {
      throw new CampaignNotFoundError();
    }

    const updateInput: UpdateCampaignInput = {
      title: input.title,
      summary: input.summary,
      description: input.description,
      marsAlignmentStatement: input.marsAlignmentStatement,
      // biome-ignore lint/suspicious/noExplicitAny: type checked at API layer
      category: input.category !== undefined ? (input.category as any) : undefined,
      minFundingTargetCents: input.minFundingTargetCents ?? undefined,
      maxFundingCapCents: input.maxFundingCapCents ?? undefined,
      deadline:
        input.deadline !== undefined
          ? input.deadline
            ? new Date(input.deadline)
            : null
          : undefined,
      budgetBreakdown: input.budgetBreakdown,
      teamInfo: input.teamInfo,
      riskDisclosures: input.riskDisclosures,
      heroImageUrl: input.heroImageUrl,
    };

    const updatedCampaign = record.campaign.withDraftUpdate(updateInput);

    let milestones = record.milestones;
    if (input.milestones !== undefined) {
      milestones = this.buildMilestones(campaignId, input.milestones);
    }

    await this.campaignRepository.update(
      updatedCampaign,
      input.milestones !== undefined ? milestones : undefined,
    );

    const seqNum = await this.eventStore.getNextSequenceNumber(campaignId);
    await this.eventStore.append({
      eventType: CAMPAIGN_EVENT_TYPES.DRAFT_UPDATED,
      aggregateId: campaignId,
      aggregateType: 'campaign',
      sequenceNumber: seqNum,
      correlationId: crypto.randomUUID(),
      sourceService: 'campaign-service',
      payload: { campaignId, creatorId: userId },
    });

    this.logger.info({ campaignId, creatorId: userId }, 'Campaign draft updated');

    return this.toResult(updatedCampaign, milestones);
  }

  async submitForReview(userId: string, campaignId: string): Promise<CampaignResult> {
    // KYC gate: must be checked before any campaign logic
    const kycStatus = await this.kycStatusPort.getVerificationStatus(userId);
    if (kycStatus.status !== 'verified') {
      throw new KycRequiredError();
    }

    const record = await this.campaignRepository.findById(campaignId);
    if (!record || record.campaign.creatorId !== userId) {
      throw new CampaignNotFoundError();
    }

    const submittedCampaign = record.campaign.submit({ milestones: record.milestones });

    await this.campaignRepository.update(submittedCampaign);

    const seqNum = await this.eventStore.getNextSequenceNumber(campaignId);
    await this.eventStore.append({
      eventType: CAMPAIGN_EVENT_TYPES.SUBMITTED,
      aggregateId: campaignId,
      aggregateType: 'campaign',
      sequenceNumber: seqNum,
      correlationId: crypto.randomUUID(),
      sourceService: 'campaign-service',
      payload: {
        campaignId,
        creatorId: userId,
        title: submittedCampaign.title,
        category: submittedCampaign.category,
      },
    });

    this.logger.info({ campaignId, creatorId: userId }, 'Campaign submitted for review');

    return this.toResult(submittedCampaign, record.milestones);
  }

  async getCampaign(userId: string, campaignId: string): Promise<CampaignResult> {
    const record = await this.campaignRepository.findById(campaignId);
    if (!record || record.campaign.creatorId !== userId) {
      throw new CampaignNotFoundError();
    }

    return this.toResult(record.campaign, record.milestones);
  }

  async listMyCampaigns(userId: string): Promise<CampaignResult[]> {
    const records = await this.campaignRepository.findByCreatorId(userId);
    return records.map((r) => this.toResult(r.campaign, r.milestones));
  }

  // ─── Review Pipeline ─────────────────────────────────────────────────────────

  /** Asserts the caller has reviewer or administrator role. */
  private assertReviewerRole(roles: readonly string[]): void {
    if (!roles.includes('reviewer') && !roles.includes('administrator')) {
      throw new InsufficientRoleError();
    }
  }

  /**
   * Returns campaigns in submitted or under_review status (FIFO ordered).
   * Requires reviewer or administrator role.
   */
  async listSubmittedCampaigns(
    _reviewerUserId: string,
    roles: readonly string[],
  ): Promise<CampaignResult[]> {
    this.assertReviewerRole(roles);
    const records = await this.campaignRepository.findSubmitted();
    return records.map((r) => this.toResult(r.campaign, r.milestones));
  }

  /**
   * Claims a submitted campaign for review (submitted → under_review).
   * Requires reviewer or administrator role.
   */
  async startReview(
    reviewerUserId: string,
    campaignId: string,
    roles: readonly string[],
  ): Promise<CampaignResult> {
    this.assertReviewerRole(roles);

    const record = await this.campaignRepository.findById(campaignId);
    if (!record) {
      throw new CampaignNotFoundError();
    }

    const updatedCampaign = record.campaign.startReview(reviewerUserId);
    await this.campaignRepository.update(updatedCampaign);

    const seqNum = await this.eventStore.getNextSequenceNumber(campaignId);
    await this.eventStore.append({
      eventType: CAMPAIGN_EVENT_TYPES.REVIEW_STARTED,
      aggregateId: campaignId,
      aggregateType: 'campaign',
      sequenceNumber: seqNum,
      correlationId: crypto.randomUUID(),
      sourceService: 'campaign-service',
      payload: {
        campaignId,
        reviewerId: reviewerUserId,
        previousStatus: record.campaign.status,
        newStatus: updatedCampaign.status,
      },
    });

    this.logger.info({ campaignId, reviewerId: reviewerUserId }, 'Campaign review started');

    return this.toResult(updatedCampaign, record.milestones);
  }

  /**
   * Approves a campaign under review (under_review → approved).
   * Requires reviewer or administrator role. Only the assigned reviewer can approve.
   */
  async approveCampaign(
    reviewerUserId: string,
    campaignId: string,
    comment: string,
    roles: readonly string[],
  ): Promise<CampaignResult> {
    this.assertReviewerRole(roles);

    const record = await this.campaignRepository.findById(campaignId);
    if (!record) {
      throw new CampaignNotFoundError();
    }

    const updatedCampaign = record.campaign.approve(reviewerUserId, comment);
    await this.campaignRepository.update(updatedCampaign);

    const seqNum = await this.eventStore.getNextSequenceNumber(campaignId);
    await this.eventStore.append({
      eventType: CAMPAIGN_EVENT_TYPES.APPROVED,
      aggregateId: campaignId,
      aggregateType: 'campaign',
      sequenceNumber: seqNum,
      correlationId: crypto.randomUUID(),
      sourceService: 'campaign-service',
      payload: {
        campaignId,
        reviewerId: reviewerUserId,
        previousStatus: record.campaign.status,
        newStatus: updatedCampaign.status,
        comment: comment.substring(0, 500),
      },
    });

    this.logger.info({ campaignId, reviewerId: reviewerUserId }, 'Campaign approved');

    return this.toResult(updatedCampaign, record.milestones);
  }

  /**
   * Rejects a campaign under review (under_review → rejected).
   * Requires reviewer or administrator role. Only the assigned reviewer can reject.
   */
  async rejectCampaign(
    reviewerUserId: string,
    campaignId: string,
    comment: string,
    roles: readonly string[],
  ): Promise<CampaignResult> {
    this.assertReviewerRole(roles);

    const record = await this.campaignRepository.findById(campaignId);
    if (!record) {
      throw new CampaignNotFoundError();
    }

    const updatedCampaign = record.campaign.reject(reviewerUserId, comment);
    await this.campaignRepository.update(updatedCampaign);

    const seqNum = await this.eventStore.getNextSequenceNumber(campaignId);
    await this.eventStore.append({
      eventType: CAMPAIGN_EVENT_TYPES.REJECTED,
      aggregateId: campaignId,
      aggregateType: 'campaign',
      sequenceNumber: seqNum,
      correlationId: crypto.randomUUID(),
      sourceService: 'campaign-service',
      payload: {
        campaignId,
        reviewerId: reviewerUserId,
        previousStatus: record.campaign.status,
        newStatus: updatedCampaign.status,
        comment: comment.substring(0, 500),
      },
    });

    this.logger.info({ campaignId, reviewerId: reviewerUserId }, 'Campaign rejected');

    return this.toResult(updatedCampaign, record.milestones);
  }

  /**
   * Reviewer recuses themselves from a campaign (under_review → submitted).
   * Requires reviewer or administrator role. Only the assigned reviewer can recuse.
   */
  async recuseCampaign(
    reviewerUserId: string,
    campaignId: string,
    roles: readonly string[],
  ): Promise<CampaignResult> {
    this.assertReviewerRole(roles);

    const record = await this.campaignRepository.findById(campaignId);
    if (!record) {
      throw new CampaignNotFoundError();
    }

    const updatedCampaign = record.campaign.recuse(reviewerUserId);
    await this.campaignRepository.update(updatedCampaign);

    const seqNum = await this.eventStore.getNextSequenceNumber(campaignId);
    await this.eventStore.append({
      eventType: CAMPAIGN_EVENT_TYPES.REVIEW_RECUSED,
      aggregateId: campaignId,
      aggregateType: 'campaign',
      sequenceNumber: seqNum,
      correlationId: crypto.randomUUID(),
      sourceService: 'campaign-service',
      payload: {
        campaignId,
        reviewerId: reviewerUserId,
        previousStatus: record.campaign.status,
        newStatus: updatedCampaign.status,
      },
    });

    this.logger.info({ campaignId, reviewerId: reviewerUserId }, 'Campaign review recused');

    return this.toResult(updatedCampaign, record.milestones);
  }

  /**
   * Creator returns a rejected campaign to draft for revision (rejected → draft).
   * Only the campaign creator may call this.
   */
  async returnCampaignToDraft(
    creatorUserId: string,
    campaignId: string,
  ): Promise<CampaignResult> {
    const record = await this.campaignRepository.findById(campaignId);
    if (!record || record.campaign.creatorId !== creatorUserId) {
      throw new CampaignNotFoundError();
    }

    const updatedCampaign = record.campaign.returnToDraft();
    await this.campaignRepository.update(updatedCampaign);

    const seqNum = await this.eventStore.getNextSequenceNumber(campaignId);
    await this.eventStore.append({
      eventType: CAMPAIGN_EVENT_TYPES.RETURNED_TO_DRAFT,
      aggregateId: campaignId,
      aggregateType: 'campaign',
      sequenceNumber: seqNum,
      correlationId: crypto.randomUUID(),
      sourceService: 'campaign-service',
      payload: {
        campaignId,
        creatorId: creatorUserId,
        previousStatus: record.campaign.status,
        newStatus: updatedCampaign.status,
      },
    });

    this.logger.info({ campaignId, creatorId: creatorUserId }, 'Campaign returned to draft');

    return this.toResult(updatedCampaign, record.milestones);
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private buildMilestones(
    campaignId: string,
    milestoneInputs: readonly MilestoneInput[],
  ): Milestone[] {
    return milestoneInputs.map((m) => {
      const createInput: CreateMilestoneInput = {
        campaignId,
        title: m.title,
        description: m.description,
        targetDate: m.targetDate ? new Date(m.targetDate) : null,
        fundingPercentage: m.fundingPercentage,
        verificationCriteria: m.verificationCriteria,
      };
      return Milestone.create(createInput);
    });
  }

  private toResult(
    campaign: Campaign,
    milestones: readonly Milestone[],
  ): CampaignResult {
    return {
      id: campaign.id,
      creatorId: campaign.creatorId,
      title: campaign.title,
      summary: campaign.summary,
      description: campaign.description,
      marsAlignmentStatement: campaign.marsAlignmentStatement,
      category: campaign.category,
      status: campaign.status,
      minFundingTargetCents: campaign.minFundingTargetCents,
      maxFundingCapCents: campaign.maxFundingCapCents,
      deadline: campaign.deadline,
      budgetBreakdown: campaign.budgetBreakdown,
      teamInfo: campaign.teamInfo,
      riskDisclosures: campaign.riskDisclosures,
      heroImageUrl: campaign.heroImageUrl,
      reviewerId: campaign.reviewerId,
      reviewerComment: campaign.reviewerComment,
      reviewedAt: campaign.reviewedAt,
      milestones: milestones.map((m) => ({
        id: m.id,
        campaignId: m.campaignId,
        title: m.title,
        description: m.description,
        targetDate: m.targetDate,
        fundingPercentage: m.fundingPercentage,
        verificationCriteria: m.verificationCriteria,
        status: m.status,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
      })),
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt,
    };
  }
}
