import type { Logger } from 'pino';
import { UserNotFoundError } from '../../account/domain/errors/account-errors.js';
import type { User } from '../../account/domain/models/user.js';
import type { UserRepository } from '../../account/ports/user-repository.port.js';
import { Campaign, type UpdateCampaignInput } from '../domain/models/campaign.js';
import type { CampaignCategory } from '../domain/value-objects/campaign-category.js';
import { CAMPAIGN_CATEGORIES } from '../domain/value-objects/campaign-category.js';
import {
  CREATOR_ARCHIVABLE_STATUSES,
  CampaignStatus,
  EDITABLE_STATUSES,
  SUBMITTABLE_STATUSES,
} from '../domain/value-objects/campaign-status.js';
import {
  AccountNotActiveError,
  AdminRoleRequiredError,
  CampaignAlreadyClaimedError,
  CampaignAlreadySubmittedError,
  CampaignCannotArchiveError,
  CampaignInvalidStateError,
  CampaignNotApprovableError,
  CampaignNotClaimableError,
  CampaignNotEditableError,
  CampaignNotFoundError,
  CampaignNotLaunchableError,
  CampaignNotRejectableError,
  CampaignNotRevizableError,
  CampaignNotSubmittableError,
  CreatorRoleRequiredError,
  KycNotVerifiedError,
  MilestoneValidationError,
  NotAssignedReviewerError,
  ReassignTargetNotReviewerError,
  ReviewerRoleRequiredError,
  SubmissionValidationError,
} from '../domain/errors/campaign-errors.js';
import type { CampaignAuditRepository } from '../ports/campaign-audit-repository.port.js';
import type { CampaignRepository } from '../ports/campaign-repository.port.js';

function isAdmin(user: User): boolean {
  return user.roles.includes('administrator') || user.roles.includes('super_administrator');
}

function isReviewer(user: User): boolean {
  return user.roles.includes('reviewer');
}

function isReviewerOrAdmin(user: User): boolean {
  return isReviewer(user) || isAdmin(user);
}

export class CampaignAppService {
  constructor(
    private readonly campaignRepository: CampaignRepository,
    private readonly campaignAuditRepository: CampaignAuditRepository,
    private readonly userRepository: UserRepository,
    private readonly logger: Logger,
  ) {}

  /**
   * Creates a new campaign draft.
   * Called by POST /api/v1/campaigns.
   */
  async createDraft(
    clerkUserId: string,
    input: { title: string },
  ): Promise<Campaign> {
    // Step 1: Load and validate user
    const user = await this.userRepository.findByClerkUserId(clerkUserId);
    if (!user) throw new UserNotFoundError(clerkUserId);

    // Step 2: Check account status
    if (user.accountStatus !== 'active') {
      throw new AccountNotActiveError();
    }

    // Step 3: Check Creator role
    if (!user.roles.includes('creator')) {
      throw new CreatorRoleRequiredError();
    }

    // Step 4: Check KYC
    if (user.kycStatus !== 'verified') {
      throw new KycNotVerifiedError();
    }

    // Step 5: Create domain entity (validates title)
    const campaign = Campaign.create({
      creatorUserId: user.id,
      title: input.title.trim(),
    });

    // Step 6: Persist
    await this.campaignRepository.save(campaign);

    // Step 7: Audit (best-effort)
    try {
      await this.campaignAuditRepository.createEvent({
        campaignId: campaign.id,
        actorUserId: user.id,
        actorClerkUserId: clerkUserId,
        action: 'campaign.created',
        previousStatus: null,
        newStatus: CampaignStatus.Draft,
      });
    } catch (auditErr) {
      this.logger.error(
        { err: auditErr, clerkUserId, campaignId: campaign.id },
        'Failed to write campaign audit event for created',
      );
    }

    return campaign;
  }

  /**
   * Auto-saves campaign draft fields. Partial update.
   * Called by PATCH /api/v1/campaigns/:id.
   */
  async updateDraft(
    clerkUserId: string,
    campaignId: string,
    input: UpdateCampaignInput,
  ): Promise<Campaign> {
    // Step 1: Load user
    const user = await this.userRepository.findByClerkUserId(clerkUserId);
    if (!user) throw new UserNotFoundError(clerkUserId);

    // Step 2: Load campaign
    const campaign = await this.campaignRepository.findById(campaignId);
    if (!campaign) throw new CampaignNotFoundError();

    // Step 3: Ownership check (do not reveal existence — 404, EC-033)
    if (campaign.creatorUserId !== user.id) {
      throw new CampaignNotFoundError();
    }

    // Step 4: Editability check
    if (!EDITABLE_STATUSES.includes(campaign.status)) {
      throw new CampaignNotEditableError();
    }

    // Step 5: Persist
    const updatedCampaign = await this.campaignRepository.updateDraftFields(campaignId, input);

    // Step 6: Audit (best-effort)
    try {
      await this.campaignAuditRepository.createEvent({
        campaignId,
        actorUserId: user.id,
        actorClerkUserId: clerkUserId,
        action: 'campaign.updated',
        previousStatus: campaign.status,
        newStatus: campaign.status,
      });
    } catch (auditErr) {
      this.logger.error(
        { err: auditErr, clerkUserId, campaignId },
        'Failed to write campaign audit event for updated',
      );
    }

    return updatedCampaign;
  }

  /**
   * Submits a campaign draft for review. Applies full submission validation.
   * Called by POST /api/v1/campaigns/:id/submit.
   */
  async submitCampaign(clerkUserId: string, campaignId: string): Promise<Campaign> {
    // Step 1: Load user
    const user = await this.userRepository.findByClerkUserId(clerkUserId);
    if (!user) throw new UserNotFoundError(clerkUserId);

    // Step 2: Check Creator role (EC-043)
    if (!user.roles.includes('creator')) {
      throw new CreatorRoleRequiredError();
    }

    // Step 3: Check KYC (EC-044)
    if (user.kycStatus !== 'verified') {
      throw new KycNotVerifiedError();
    }

    // Step 4: Load campaign
    const campaign = await this.campaignRepository.findById(campaignId);
    if (!campaign) throw new CampaignNotFoundError();

    // Step 5: Ownership check
    if (campaign.creatorUserId !== user.id) {
      throw new CampaignNotFoundError();
    }

    // Step 6: State check
    if (
      campaign.status === CampaignStatus.UnderReview ||
      campaign.status === CampaignStatus.Approved
    ) {
      throw new CampaignNotRevizableError();
    }
    if (!SUBMITTABLE_STATUSES.includes(campaign.status)) {
      throw new CampaignNotSubmittableError();
    }

    // Step 7: Submission validation — validate ALL required fields
    const now = new Date();

    // title
    if (!campaign.title || campaign.title.trim().length === 0) {
      throw new SubmissionValidationError('title', 'Title is required.');
    }

    // shortDescription
    if (!campaign.shortDescription || campaign.shortDescription.trim().length === 0) {
      throw new SubmissionValidationError('shortDescription', 'Short description is required.');
    }
    if (campaign.shortDescription.length > 500) {
      throw new SubmissionValidationError(
        'shortDescription',
        'Short description must be 500 characters or fewer.',
      );
    }

    // description
    if (!campaign.description || campaign.description.trim().length === 0) {
      throw new SubmissionValidationError('description', 'Description is required.');
    }
    if (campaign.description.length > 10000) {
      throw new SubmissionValidationError(
        'description',
        'Description must be 10,000 characters or fewer.',
      );
    }

    // alignmentStatement
    if (!campaign.alignmentStatement || campaign.alignmentStatement.trim().length === 0) {
      throw new SubmissionValidationError(
        'alignmentStatement',
        'Alignment statement is required.',
      );
    }
    if (campaign.alignmentStatement.length > 1000) {
      throw new SubmissionValidationError(
        'alignmentStatement',
        'Alignment statement must be 1,000 characters or fewer.',
      );
    }

    // category
    if (!campaign.category || !CAMPAIGN_CATEGORIES.includes(campaign.category as CampaignCategory)) {
      throw new SubmissionValidationError('category', 'A valid category is required.');
    }

    // fundingGoalCents
    if (!campaign.fundingGoalCents) {
      throw new SubmissionValidationError('fundingGoalCents', 'Funding goal is required.');
    }
    const goalCents = BigInt(campaign.fundingGoalCents);
    const MIN_FUNDING_CENTS = BigInt(100_000_000); // $1M in cents
    if (goalCents < MIN_FUNDING_CENTS) {
      throw new SubmissionValidationError(
        'fundingGoalCents',
        'Funding goal must be at least $1,000,000 (100,000,000 cents).',
      );
    }

    // fundingCapCents
    if (!campaign.fundingCapCents) {
      throw new SubmissionValidationError('fundingCapCents', 'Funding cap is required.');
    }
    const capCents = BigInt(campaign.fundingCapCents);
    if (capCents < goalCents) {
      throw new SubmissionValidationError(
        'fundingCapCents',
        'Funding cap must be greater than or equal to the funding goal.',
      );
    }

    // deadline
    if (!campaign.deadline) {
      throw new SubmissionValidationError('deadline', 'Deadline is required.');
    }
    const deadlineMs = campaign.deadline.getTime();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const threeSixtyFiveDaysMs = 365 * 24 * 60 * 60 * 1000;
    if (deadlineMs < now.getTime() + sevenDaysMs) {
      throw new SubmissionValidationError(
        'deadline',
        'Deadline must be at least 7 days from the submission date.',
      );
    }
    if (deadlineMs > now.getTime() + threeSixtyFiveDaysMs) {
      throw new SubmissionValidationError(
        'deadline',
        'Deadline must be within 1 year of the submission date.',
      );
    }

    // teamMembers
    if (campaign.teamMembers.length < 1) {
      throw new SubmissionValidationError(
        'teamMembers',
        'At least one team member is required.',
      );
    }
    if (campaign.teamMembers.length > 20) {
      throw new SubmissionValidationError('teamMembers', 'Maximum 20 team members allowed.');
    }

    // milestones
    if (campaign.milestones.length < 2) {
      throw new MilestoneValidationError(
        'milestones',
        'At least two milestones are required.',
      );
    }
    if (campaign.milestones.length > 10) {
      throw new MilestoneValidationError('milestones', 'Maximum 10 milestones allowed.');
    }
    for (const milestone of campaign.milestones) {
      if (milestone.fundingBasisPoints < 1) {
        throw new MilestoneValidationError(
          'milestones',
          'Each milestone fundingBasisPoints must be at least 1.',
        );
      }
    }
    const basisPointsSum = campaign.milestones.reduce(
      (sum, m) => sum + m.fundingBasisPoints,
      0,
    );
    if (basisPointsSum !== 10000) {
      throw new MilestoneValidationError(
        'milestones',
        `Milestone funding basis points must sum to 10000. Current sum: ${basisPointsSum}.`,
      );
    }

    // riskDisclosures
    if (campaign.riskDisclosures.length < 1) {
      throw new SubmissionValidationError(
        'riskDisclosures',
        'At least one risk disclosure is required.',
      );
    }
    if (campaign.riskDisclosures.length > 10) {
      throw new SubmissionValidationError(
        'riskDisclosures',
        'Maximum 10 risk disclosures allowed.',
      );
    }

    // Step 8: Atomic state transition
    let updatedCampaign: Campaign;
    try {
      updatedCampaign = await this.campaignRepository.updateStatus(
        campaignId,
        campaign.status,
        CampaignStatus.Submitted,
        { submittedAt: now },
      );
    } catch (err) {
      if (err instanceof CampaignAlreadyClaimedError) {
        throw new CampaignAlreadySubmittedError();
      }
      throw err;
    }

    // Step 9: Audit (best-effort)
    try {
      await this.campaignAuditRepository.createEvent({
        campaignId,
        actorUserId: user.id,
        actorClerkUserId: clerkUserId,
        action: 'campaign.submitted',
        previousStatus: campaign.status,
        newStatus: CampaignStatus.Submitted,
      });
    } catch (auditErr) {
      this.logger.error(
        { err: auditErr, clerkUserId, campaignId },
        'Failed to write campaign audit event for submitted',
      );
    }

    return updatedCampaign;
  }

  /**
   * Returns full campaign detail with access control.
   * Called by GET /api/v1/campaigns/:id.
   */
  async getCampaign(clerkUserId: string, campaignId: string): Promise<Campaign> {
    // Step 1: Load user
    const user = await this.userRepository.findByClerkUserId(clerkUserId);
    if (!user) throw new UserNotFoundError(clerkUserId);

    // Step 2: Load campaign
    const campaign = await this.campaignRepository.findById(campaignId);
    if (!campaign) throw new CampaignNotFoundError();

    // Step 3: Access control check
    if (isAdmin(user)) {
      // Admin can access any campaign
      return campaign;
    }

    if (isReviewer(user)) {
      // Reviewers cannot see drafts (EC-034)
      if (campaign.status === CampaignStatus.Draft) {
        throw new CampaignNotFoundError();
      }
      return campaign;
    }

    if (campaign.creatorUserId === user.id) {
      // Creator can access their own campaigns in any status
      return campaign;
    }

    // Public: only live and beyond
    const publicStatuses: readonly string[] = [
      CampaignStatus.Live,
      CampaignStatus.Funded,
      CampaignStatus.Suspended,
      CampaignStatus.Failed,
      CampaignStatus.Settlement,
      CampaignStatus.Complete,
      CampaignStatus.Cancelled,
    ];
    if (!publicStatuses.includes(campaign.status)) {
      throw new CampaignNotFoundError();
    }

    return campaign;
  }

  /**
   * Returns all campaigns created by the authenticated user.
   * Called by GET /api/v1/me/campaigns.
   */
  async listMyCampaigns(clerkUserId: string): Promise<Campaign[]> {
    // Step 1: Load user
    const user = await this.userRepository.findByClerkUserId(clerkUserId);
    if (!user) throw new UserNotFoundError(clerkUserId);

    // Step 2: Query
    return this.campaignRepository.findByCreatorUserId(user.id);
  }

  /**
   * Returns submitted campaigns in FIFO order for review.
   * Called by GET /api/v1/campaigns/review-queue.
   */
  async getReviewQueue(clerkUserId: string): Promise<Campaign[]> {
    // Step 1: Load user
    const user = await this.userRepository.findByClerkUserId(clerkUserId);
    if (!user) throw new UserNotFoundError(clerkUserId);

    // Step 2: Role check
    if (!isReviewerOrAdmin(user)) {
      throw new ReviewerRoleRequiredError();
    }

    // Step 3: Query
    return this.campaignRepository.findSubmittedOrderedBySubmittedAt();
  }

  /**
   * Claims a submitted campaign for review.
   * Called by POST /api/v1/campaigns/:id/claim.
   */
  async claimCampaign(clerkUserId: string, campaignId: string): Promise<Campaign> {
    // Step 1: Load user
    const user = await this.userRepository.findByClerkUserId(clerkUserId);
    if (!user) throw new UserNotFoundError(clerkUserId);

    // Step 2: Role check
    if (!isReviewerOrAdmin(user)) {
      throw new ReviewerRoleRequiredError();
    }

    // Step 3: Load campaign
    const campaign = await this.campaignRepository.findById(campaignId);
    if (!campaign) throw new CampaignNotFoundError();

    // Step 4: Pre-check state
    if (campaign.status !== CampaignStatus.Submitted) {
      throw new CampaignNotClaimableError();
    }

    // Step 5: Atomic claim
    const updatedCampaign = await this.campaignRepository.updateStatus(
      campaignId,
      CampaignStatus.Submitted,
      CampaignStatus.UnderReview,
      { reviewedByUserId: user.id },
    );
    // If throws CampaignAlreadyClaimedError (0 rows), it propagates as-is (409)

    // Step 6: Audit (best-effort)
    try {
      await this.campaignAuditRepository.createEvent({
        campaignId,
        actorUserId: user.id,
        actorClerkUserId: clerkUserId,
        action: 'campaign.claimed',
        previousStatus: CampaignStatus.Submitted,
        newStatus: CampaignStatus.UnderReview,
      });
    } catch (auditErr) {
      this.logger.error(
        { err: auditErr, clerkUserId, campaignId },
        'Failed to write campaign audit event for claimed',
      );
    }

    return updatedCampaign;
  }

  /**
   * Approves a campaign.
   * Called by POST /api/v1/campaigns/:id/approve.
   */
  async approveCampaign(
    clerkUserId: string,
    campaignId: string,
    reviewNotes: string,
  ): Promise<Campaign> {
    // Step 1: Load user
    const user = await this.userRepository.findByClerkUserId(clerkUserId);
    if (!user) throw new UserNotFoundError(clerkUserId);

    // Step 2: Role check
    if (!isReviewerOrAdmin(user)) {
      throw new ReviewerRoleRequiredError();
    }

    // Step 3: Load campaign
    const campaign = await this.campaignRepository.findById(campaignId);
    if (!campaign) throw new CampaignNotFoundError();

    // Step 4: State check
    if (campaign.status !== CampaignStatus.UnderReview) {
      throw new CampaignNotApprovableError();
    }

    // Step 5: Reviewer assignment check (EC-019)
    if (campaign.reviewedByUserId !== user.id && !isAdmin(user)) {
      throw new NotAssignedReviewerError();
    }

    // Step 6: Validate notes (defence in depth)
    if (!reviewNotes.trim()) {
      throw new SubmissionValidationError('reviewNotes', 'Approval notes are required.');
    }

    // Step 7: Atomic approve
    const updatedCampaign = await this.campaignRepository.updateStatus(
      campaignId,
      CampaignStatus.UnderReview,
      CampaignStatus.Approved,
      { reviewNotes: reviewNotes.trim(), reviewedAt: new Date() },
    );

    // Step 8: Audit (best-effort)
    try {
      await this.campaignAuditRepository.createEvent({
        campaignId,
        actorUserId: user.id,
        actorClerkUserId: clerkUserId,
        action: 'campaign.approved',
        previousStatus: CampaignStatus.UnderReview,
        newStatus: CampaignStatus.Approved,
        rationale: reviewNotes.trim(),
      });
    } catch (auditErr) {
      this.logger.error(
        { err: auditErr, clerkUserId, campaignId },
        'Failed to write campaign audit event for approved',
      );
    }

    return updatedCampaign;
  }

  /**
   * Rejects a campaign with rationale and guidance.
   * Called by POST /api/v1/campaigns/:id/reject.
   */
  async rejectCampaign(
    clerkUserId: string,
    campaignId: string,
    rejectionReason: string,
    resubmissionGuidance: string,
  ): Promise<Campaign> {
    // Step 1: Load user
    const user = await this.userRepository.findByClerkUserId(clerkUserId);
    if (!user) throw new UserNotFoundError(clerkUserId);

    // Step 2: Role check
    if (!isReviewerOrAdmin(user)) {
      throw new ReviewerRoleRequiredError();
    }

    // Step 3: Load campaign
    const campaign = await this.campaignRepository.findById(campaignId);
    if (!campaign) throw new CampaignNotFoundError();

    // Step 4: State check
    if (campaign.status !== CampaignStatus.UnderReview) {
      throw new CampaignNotRejectableError();
    }

    // Step 5: Reviewer assignment check (EC-019)
    if (campaign.reviewedByUserId !== user.id && !isAdmin(user)) {
      throw new NotAssignedReviewerError();
    }

    // Step 6: Validate fields (EC-021)
    if (!rejectionReason.trim()) {
      throw new SubmissionValidationError('rejectionReason', 'Rejection reason is required.');
    }
    if (!resubmissionGuidance.trim()) {
      throw new SubmissionValidationError(
        'resubmissionGuidance',
        'Resubmission guidance is required.',
      );
    }

    // Step 7: Atomic reject
    const updatedCampaign = await this.campaignRepository.updateStatus(
      campaignId,
      CampaignStatus.UnderReview,
      CampaignStatus.Rejected,
      {
        rejectionReason: rejectionReason.trim(),
        resubmissionGuidance: resubmissionGuidance.trim(),
        reviewedAt: new Date(),
      },
    );

    // Step 8: Audit (best-effort)
    try {
      await this.campaignAuditRepository.createEvent({
        campaignId,
        actorUserId: user.id,
        actorClerkUserId: clerkUserId,
        action: 'campaign.rejected',
        previousStatus: CampaignStatus.UnderReview,
        newStatus: CampaignStatus.Rejected,
        rationale: rejectionReason.trim(),
      });
    } catch (auditErr) {
      this.logger.error(
        { err: auditErr, clerkUserId, campaignId },
        'Failed to write campaign audit event for rejected',
      );
    }

    return updatedCampaign;
  }

  /**
   * Launches an approved campaign to Live status.
   * Called by POST /api/v1/campaigns/:id/launch.
   */
  async launchCampaign(clerkUserId: string, campaignId: string): Promise<Campaign> {
    // Step 1: Load user
    const user = await this.userRepository.findByClerkUserId(clerkUserId);
    if (!user) throw new UserNotFoundError(clerkUserId);

    // Step 2: Load campaign
    const campaign = await this.campaignRepository.findById(campaignId);
    if (!campaign) throw new CampaignNotFoundError();

    // Step 3: Ownership check
    if (campaign.creatorUserId !== user.id) {
      throw new CampaignNotFoundError();
    }

    // Step 4: State check
    if (campaign.status !== CampaignStatus.Approved) {
      throw new CampaignNotLaunchableError();
    }

    // Step 5: Atomic launch
    const now = new Date();
    const updatedCampaign = await this.campaignRepository.updateStatus(
      campaignId,
      CampaignStatus.Approved,
      CampaignStatus.Live,
      { launchedAt: now },
    );

    // Step 6: Audit (best-effort)
    try {
      await this.campaignAuditRepository.createEvent({
        campaignId,
        actorUserId: user.id,
        actorClerkUserId: clerkUserId,
        action: 'campaign.launched',
        previousStatus: CampaignStatus.Approved,
        newStatus: CampaignStatus.Live,
      });
    } catch (auditErr) {
      this.logger.error(
        { err: auditErr, clerkUserId, campaignId },
        'Failed to write campaign audit event for launched',
      );
    }

    // Future integration note: Step 7.5 - this is where escrow creation would be
    // triggered in a future feature (feat-005 Contribution Flow).

    return updatedCampaign;
  }

  /**
   * Archives a campaign.
   * Called by POST /api/v1/campaigns/:id/archive.
   */
  async archiveCampaign(clerkUserId: string, campaignId: string): Promise<Campaign> {
    // Step 1: Load user
    const user = await this.userRepository.findByClerkUserId(clerkUserId);
    if (!user) throw new UserNotFoundError(clerkUserId);

    // Step 2: Load campaign
    const campaign = await this.campaignRepository.findById(campaignId);
    if (!campaign) throw new CampaignNotFoundError();

    const previousStatus = campaign.status;

    // Step 3: Access check
    if (isAdmin(user)) {
      // Admin can archive any campaign in any status
    } else if (campaign.creatorUserId === user.id) {
      // Creator can only archive draft/rejected
      if (!CREATOR_ARCHIVABLE_STATUSES.includes(campaign.status)) {
        throw new CampaignCannotArchiveError();
      }
    } else {
      // No access
      throw new CampaignNotFoundError();
    }

    // Step 4: Atomic archive
    const updatedCampaign = await this.campaignRepository.updateStatus(
      campaignId,
      campaign.status,
      CampaignStatus.Archived,
      {},
    );

    // Step 5: Audit (best-effort)
    try {
      await this.campaignAuditRepository.createEvent({
        campaignId,
        actorUserId: user.id,
        actorClerkUserId: clerkUserId,
        action: 'campaign.archived',
        previousStatus,
        newStatus: CampaignStatus.Archived,
      });
    } catch (auditErr) {
      this.logger.error(
        { err: auditErr, clerkUserId, campaignId },
        'Failed to write campaign audit event for archived',
      );
    }

    return updatedCampaign;
  }

  /**
   * Reassigns a campaign's reviewer. Admin only.
   * Called by POST /api/v1/campaigns/:id/reassign.
   */
  async reassignReviewer(
    clerkUserId: string,
    campaignId: string,
    newReviewerUserId: string,
  ): Promise<Campaign> {
    // Step 1: Load user
    const user = await this.userRepository.findByClerkUserId(clerkUserId);
    if (!user) throw new UserNotFoundError(clerkUserId);

    // Step 2: Admin role check
    if (!isAdmin(user)) {
      throw new AdminRoleRequiredError();
    }

    // Step 3: Load campaign
    const campaign = await this.campaignRepository.findById(campaignId);
    if (!campaign) throw new CampaignNotFoundError();

    // Step 4: State check
    if (campaign.status !== CampaignStatus.UnderReview) {
      throw new CampaignInvalidStateError();
    }

    // Step 5: Validate new reviewer
    const newReviewer = await this.userRepository.findById(newReviewerUserId);
    if (!newReviewer) {
      throw new UserNotFoundError(newReviewerUserId);
    }
    if (!newReviewer.roles.includes('reviewer')) {
      throw new ReassignTargetNotReviewerError();
    }

    // Step 6: Capture previous reviewer
    const previousReviewerUserId = campaign.reviewedByUserId;

    // Step 7: Update
    const updatedCampaign = await this.campaignRepository.updateStatus(
      campaignId,
      CampaignStatus.UnderReview,
      CampaignStatus.UnderReview,
      { reviewedByUserId: newReviewerUserId },
    );

    // Step 8: Audit (best-effort)
    try {
      await this.campaignAuditRepository.createEvent({
        campaignId,
        actorUserId: user.id,
        actorClerkUserId: clerkUserId,
        action: 'campaign.reassigned',
        previousStatus: CampaignStatus.UnderReview,
        newStatus: CampaignStatus.UnderReview,
        metadata: { previousReviewerUserId, newReviewerUserId },
      });
    } catch (auditErr) {
      this.logger.error(
        { err: auditErr, clerkUserId, campaignId },
        'Failed to write campaign audit event for reassigned',
      );
    }

    return updatedCampaign;
  }
}
