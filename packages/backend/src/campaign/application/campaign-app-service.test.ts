import pino from 'pino';
import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryUserRepository } from '../../account/adapters/in-memory-user-repository.adapter.js';
import { User, type UserData } from '../../account/domain/models/user.js';
import { AccountStatus } from '../../account/domain/value-objects/account-status.js';
import { KycStatus } from '../../account/domain/value-objects/kyc-status.js';
import { NotificationPreferences } from '../../account/domain/value-objects/notification-preferences.js';
import { Role } from '../../account/domain/value-objects/role.js';
import { InMemoryCampaignAuditRepository } from '../adapters/in-memory-campaign-audit-repository.adapter.js';
import { InMemoryCampaignRepository } from '../adapters/in-memory-campaign-repository.adapter.js';
import { Campaign } from '../domain/models/campaign.js';
import {
  AccountNotActiveError,
  AdminRoleRequiredError,
  CampaignCannotArchiveError,
  CampaignInvalidStateError,
  CampaignNotApprovableError,
  CampaignNotClaimableError,
  CampaignNotFoundError,
  CampaignNotLaunchableError,
  CampaignNotRejectableError,
  CampaignNotRevizableError,
  CreatorRoleRequiredError,
  KycNotVerifiedError,
  NotAssignedReviewerError,
  ReassignTargetNotReviewerError,
  ReviewerRoleRequiredError,
  SubmissionValidationError,
} from '../domain/errors/campaign-errors.js';
import { CampaignAppService } from './campaign-app-service.js';

const logger = pino({ level: 'silent' });

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Stable UUID-shaped IDs for tests
const USER_IDS: Record<string, string> = {};
function getUserId(clerkUserId: string): string {
  if (!USER_IDS[clerkUserId]) {
    USER_IDS[clerkUserId] = crypto.randomUUID();
  }
  return USER_IDS[clerkUserId];
}

function makeUserData(
  clerkUserId: string,
  overrides: Partial<UserData> = {},
): UserData {
  return {
    id: getUserId(clerkUserId),
    clerkUserId,
    email: `${clerkUserId}@test.mmf`,
    displayName: null,
    bio: null,
    avatarUrl: null,
    accountStatus: AccountStatus.Active,
    onboardingCompleted: false,
    onboardingStep: null,
    roles: [Role.Creator, Role.Backer],
    notificationPrefs: NotificationPreferences.defaults(),
    kycStatus: KycStatus.Verified,
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

function makeFullCampaignData(_creatorUserId: string) {
  const futureDeadline = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // 60 days
  return {
    title: 'HelioShield: Advanced Radiation Protection',
    shortDescription: 'Protecting Mars crews from solar radiation.',
    description: 'A comprehensive protection system designed to shield Mars crews from radiation. '.repeat(3),
    category: 'radiation_protection' as const,
    heroImageUrl: null,
    fundingGoalCents: '100000000',
    fundingCapCents: '150000000',
    deadline: futureDeadline.toISOString(),
    milestones: [
      { id: crypto.randomUUID(), title: 'Phase 1', description: 'Research', fundingBasisPoints: 5000, targetDate: '2026-08-01' },
      { id: crypto.randomUUID(), title: 'Phase 2', description: 'Build', fundingBasisPoints: 5000, targetDate: '2026-12-01' },
    ],
    teamMembers: [{ id: crypto.randomUUID(), name: 'Dr. Ada', role: 'Lead', bio: 'Expert in radiation' }],
    riskDisclosures: [{ id: crypto.randomUUID(), risk: 'Technical delays', mitigation: 'Buffer time built in' }],
    budgetBreakdown: [],
    alignmentStatement: 'This project directly enables safe long-term Mars habitation.',
    tags: ['radiation', 'safety'],
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CampaignAppService.createDraft()', () => {
  let userRepo: InMemoryUserRepository;
  let campaignRepo: InMemoryCampaignRepository;
  let auditRepo: InMemoryCampaignAuditRepository;
  let service: CampaignAppService;

  beforeEach(() => {
    userRepo = new InMemoryUserRepository();
    campaignRepo = new InMemoryCampaignRepository();
    auditRepo = new InMemoryCampaignAuditRepository();
    service = new CampaignAppService(campaignRepo, auditRepo, userRepo, logger);
  });

  it('creates a draft campaign for a valid creator', async () => {
    const user = seedUser(userRepo, 'creator_001');

    const campaign = await service.createDraft('creator_001', { title: 'Mars Shield' });

    expect(campaign.id).toBeDefined();
    expect(campaign.title).toBe('Mars Shield');
    expect(campaign.status).toBe('draft');
    expect(campaign.creatorUserId).toBe(user.id);
  });

  it('persists the campaign', async () => {
    seedUser(userRepo, 'creator_001');
    const campaign = await service.createDraft('creator_001', { title: 'Persisted Campaign' });

    const found = await campaignRepo.findById(campaign.id);
    expect(found).not.toBeNull();
  });

  it('writes an audit event', async () => {
    seedUser(userRepo, 'creator_001');
    const campaign = await service.createDraft('creator_001', { title: 'Audit Test' });

    expect(auditRepo.events).toHaveLength(1);
    expect(auditRepo.events[0]?.action).toBe('campaign.created');
    expect(auditRepo.events[0]?.campaignId).toBe(campaign.id);
  });

  it('throws CreatorRoleRequiredError if user lacks creator role', async () => {
    seedUser(userRepo, 'backer_001', { roles: [Role.Backer] });
    await expect(service.createDraft('backer_001', { title: 'X' })).rejects.toThrow(
      CreatorRoleRequiredError,
    );
  });

  it('throws KycNotVerifiedError if KYC not verified', async () => {
    seedUser(userRepo, 'creator_001', { kycStatus: KycStatus.NotStarted });
    await expect(service.createDraft('creator_001', { title: 'X' })).rejects.toThrow(
      KycNotVerifiedError,
    );
  });

  it('throws AccountNotActiveError if account not active', async () => {
    seedUser(userRepo, 'creator_001', { accountStatus: AccountStatus.PendingVerification });
    await expect(service.createDraft('creator_001', { title: 'X' })).rejects.toThrow(
      AccountNotActiveError,
    );
  });
});

describe('CampaignAppService.updateDraft()', () => {
  let userRepo: InMemoryUserRepository;
  let campaignRepo: InMemoryCampaignRepository;
  let auditRepo: InMemoryCampaignAuditRepository;
  let service: CampaignAppService;

  beforeEach(() => {
    userRepo = new InMemoryUserRepository();
    campaignRepo = new InMemoryCampaignRepository();
    auditRepo = new InMemoryCampaignAuditRepository();
    service = new CampaignAppService(campaignRepo, auditRepo, userRepo, logger);
  });

  it('updates draft fields for the owner', async () => {
    const user = seedUser(userRepo, 'creator_001');
    const campaign = Campaign.create({ creatorUserId: user.id, title: 'Original' });
    await campaignRepo.save(campaign);

    const updated = await service.updateDraft('creator_001', campaign.id, {
      title: 'Updated Title',
      shortDescription: 'Short desc',
    });

    expect(updated.title).toBe('Updated Title');
    expect(updated.shortDescription).toBe('Short desc');
  });

  it('throws CampaignNotFoundError for non-existent campaign', async () => {
    seedUser(userRepo, 'creator_001');
    await expect(
      service.updateDraft('creator_001', 'non-existent-id', { title: 'X' }),
    ).rejects.toThrow(CampaignNotFoundError);
  });

  it('throws CampaignNotFoundError for campaigns not owned by user', async () => {
    seedUser(userRepo, 'creator_001');
    const otherUser = seedUser(userRepo, 'creator_002');
    const campaign = Campaign.create({ creatorUserId: otherUser.id, title: 'Other Campaign' });
    await campaignRepo.save(campaign);

    await expect(
      service.updateDraft('creator_001', campaign.id, { title: 'X' }),
    ).rejects.toThrow(CampaignNotFoundError);
  });
});

describe('CampaignAppService.submitCampaign()', () => {
  let userRepo: InMemoryUserRepository;
  let campaignRepo: InMemoryCampaignRepository;
  let auditRepo: InMemoryCampaignAuditRepository;
  let service: CampaignAppService;

  beforeEach(() => {
    userRepo = new InMemoryUserRepository();
    campaignRepo = new InMemoryCampaignRepository();
    auditRepo = new InMemoryCampaignAuditRepository();
    service = new CampaignAppService(campaignRepo, auditRepo, userRepo, logger);
  });

  async function createFullCampaignInDraft(clerkUserId: string): Promise<Campaign> {
    const user = seedUser(userRepo, clerkUserId);
    const fullData = makeFullCampaignData(user.id);
    const campaign = Campaign.create({ creatorUserId: user.id, title: fullData.title });
    await campaignRepo.save(campaign);
    await campaignRepo.updateDraftFields(campaign.id, fullData);
    return (await campaignRepo.findById(campaign.id))!;
  }

  it('submits a fully valid campaign', async () => {
    const campaign = await createFullCampaignInDraft('creator_001');
    const submitted = await service.submitCampaign('creator_001', campaign.id);

    expect(submitted.status).toBe('submitted');
    expect(submitted.submittedAt).toBeInstanceOf(Date);
  });

  it('throws CreatorRoleRequiredError if user lacks creator role', async () => {
    const user = seedUser(userRepo, 'backer_001', { roles: [Role.Backer] });
    const campaign = Campaign.create({ creatorUserId: user.id, title: 'X' });
    await campaignRepo.save(campaign);

    await expect(service.submitCampaign('backer_001', campaign.id)).rejects.toThrow(
      CreatorRoleRequiredError,
    );
  });

  it('throws SubmissionValidationError for missing shortDescription', async () => {
    const user = seedUser(userRepo, 'creator_001');
    const fullData = makeFullCampaignData(user.id);
    const campaign = Campaign.create({ creatorUserId: user.id, title: fullData.title });
    await campaignRepo.save(campaign);
    // Update without shortDescription
    await campaignRepo.updateDraftFields(campaign.id, {
      ...fullData,
      shortDescription: undefined, // missing
    });

    await expect(service.submitCampaign('creator_001', campaign.id)).rejects.toThrow(
      SubmissionValidationError,
    );
  });

  it('throws CampaignNotRevizableError for under_review campaign', async () => {
    const campaign = await createFullCampaignInDraft('creator_001');
    const user = seedUser(userRepo, 'reviewer_001', { roles: [Role.Reviewer, Role.Backer] });
    // Simulate campaign going to under_review
    await campaignRepo.updateStatus(campaign.id, 'draft', 'submitted', { submittedAt: new Date() });
    await campaignRepo.updateStatus(campaign.id, 'submitted', 'under_review', { reviewedByUserId: user.id });

    await expect(service.submitCampaign('creator_001', campaign.id)).rejects.toThrow(
      CampaignNotRevizableError,
    );
  });
});

describe('CampaignAppService.getCampaign()', () => {
  let userRepo: InMemoryUserRepository;
  let campaignRepo: InMemoryCampaignRepository;
  let auditRepo: InMemoryCampaignAuditRepository;
  let service: CampaignAppService;

  beforeEach(() => {
    userRepo = new InMemoryUserRepository();
    campaignRepo = new InMemoryCampaignRepository();
    auditRepo = new InMemoryCampaignAuditRepository();
    service = new CampaignAppService(campaignRepo, auditRepo, userRepo, logger);
  });

  it('allows creator to see their own draft', async () => {
    const user = seedUser(userRepo, 'creator_001');
    const campaign = Campaign.create({ creatorUserId: user.id, title: 'My Draft' });
    await campaignRepo.save(campaign);

    const found = await service.getCampaign('creator_001', campaign.id);
    expect(found.id).toBe(campaign.id);
  });

  it('throws CampaignNotFoundError for reviewer viewing a draft', async () => {
    const creator = seedUser(userRepo, 'creator_001');
    seedUser(userRepo, 'reviewer_001', { roles: [Role.Reviewer, Role.Backer] });
    const campaign = Campaign.create({ creatorUserId: creator.id, title: 'Draft' });
    await campaignRepo.save(campaign);

    await expect(service.getCampaign('reviewer_001', campaign.id)).rejects.toThrow(
      CampaignNotFoundError,
    );
  });

  it('allows admin to see any campaign', async () => {
    const creator = seedUser(userRepo, 'creator_001');
    seedUser(userRepo, 'admin_001', { roles: [Role.Administrator, Role.Backer] });
    const campaign = Campaign.create({ creatorUserId: creator.id, title: 'Draft' });
    await campaignRepo.save(campaign);

    const found = await service.getCampaign('admin_001', campaign.id);
    expect(found.id).toBe(campaign.id);
  });
});

describe('CampaignAppService.getReviewQueue()', () => {
  let userRepo: InMemoryUserRepository;
  let campaignRepo: InMemoryCampaignRepository;
  let auditRepo: InMemoryCampaignAuditRepository;
  let service: CampaignAppService;

  beforeEach(() => {
    userRepo = new InMemoryUserRepository();
    campaignRepo = new InMemoryCampaignRepository();
    auditRepo = new InMemoryCampaignAuditRepository();
    service = new CampaignAppService(campaignRepo, auditRepo, userRepo, logger);
  });

  it('returns submitted campaigns for reviewer', async () => {
    const creator = seedUser(userRepo, 'creator_001');
    seedUser(userRepo, 'reviewer_001', { roles: [Role.Reviewer, Role.Backer] });

    const c1 = Campaign.create({ creatorUserId: creator.id, title: 'Camp 1' });
    await campaignRepo.save(c1);
    await campaignRepo.updateStatus(c1.id, 'draft', 'submitted', { submittedAt: new Date('2026-03-01') });

    const queue = await service.getReviewQueue('reviewer_001');
    expect(queue).toHaveLength(1);
    expect(queue[0]?.status).toBe('submitted');
  });

  it('throws ReviewerRoleRequiredError for non-reviewer', async () => {
    seedUser(userRepo, 'backer_001', { roles: [Role.Backer] });
    await expect(service.getReviewQueue('backer_001')).rejects.toThrow(ReviewerRoleRequiredError);
  });

  it('returns empty array when no submitted campaigns', async () => {
    seedUser(userRepo, 'reviewer_001', { roles: [Role.Reviewer, Role.Backer] });
    const queue = await service.getReviewQueue('reviewer_001');
    expect(queue).toEqual([]);
  });
});

describe('CampaignAppService.claimCampaign()', () => {
  let userRepo: InMemoryUserRepository;
  let campaignRepo: InMemoryCampaignRepository;
  let auditRepo: InMemoryCampaignAuditRepository;
  let service: CampaignAppService;

  beforeEach(() => {
    userRepo = new InMemoryUserRepository();
    campaignRepo = new InMemoryCampaignRepository();
    auditRepo = new InMemoryCampaignAuditRepository();
    service = new CampaignAppService(campaignRepo, auditRepo, userRepo, logger);
  });

  it('claims a submitted campaign', async () => {
    const creator = seedUser(userRepo, 'creator_001');
    const reviewer = seedUser(userRepo, 'reviewer_001', { roles: [Role.Reviewer, Role.Backer] });
    const campaign = Campaign.create({ creatorUserId: creator.id, title: 'Camp' });
    await campaignRepo.save(campaign);
    await campaignRepo.updateStatus(campaign.id, 'draft', 'submitted', { submittedAt: new Date() });

    const claimed = await service.claimCampaign('reviewer_001', campaign.id);
    expect(claimed.status).toBe('under_review');
    expect(claimed.reviewedByUserId).toBe(reviewer.id);
  });

  it('throws CampaignNotClaimableError for non-submitted campaign', async () => {
    const creator = seedUser(userRepo, 'creator_001');
    seedUser(userRepo, 'reviewer_001', { roles: [Role.Reviewer, Role.Backer] });
    const campaign = Campaign.create({ creatorUserId: creator.id, title: 'Draft' });
    await campaignRepo.save(campaign);

    await expect(service.claimCampaign('reviewer_001', campaign.id)).rejects.toThrow(
      CampaignNotClaimableError,
    );
  });

  it('throws CampaignNotClaimableError when campaign is already under_review (pre-check fires)', async () => {
    // When the pre-check fires for an already-claimed campaign (status = under_review),
    // CampaignNotClaimableError is thrown (not CampaignAlreadyClaimedError).
    // CampaignAlreadyClaimedError is only thrown by the atomic DB update on a true race condition.
    const creator = seedUser(userRepo, 'creator_001');
    seedUser(userRepo, 'reviewer_001', { roles: [Role.Reviewer, Role.Backer] });
    seedUser(userRepo, 'reviewer_002', { roles: [Role.Reviewer, Role.Backer] });
    const campaign = Campaign.create({ creatorUserId: creator.id, title: 'Camp' });
    await campaignRepo.save(campaign);
    await campaignRepo.updateStatus(campaign.id, 'draft', 'submitted', { submittedAt: new Date() });

    // First claim succeeds
    await service.claimCampaign('reviewer_001', campaign.id);

    // Second claim should fail (pre-check sees under_review status)
    await expect(service.claimCampaign('reviewer_002', campaign.id)).rejects.toThrow(
      CampaignNotClaimableError,
    );
  });
});

describe('CampaignAppService.approveCampaign()', () => {
  let userRepo: InMemoryUserRepository;
  let campaignRepo: InMemoryCampaignRepository;
  let auditRepo: InMemoryCampaignAuditRepository;
  let service: CampaignAppService;

  beforeEach(() => {
    userRepo = new InMemoryUserRepository();
    campaignRepo = new InMemoryCampaignRepository();
    auditRepo = new InMemoryCampaignAuditRepository();
    service = new CampaignAppService(campaignRepo, auditRepo, userRepo, logger);
  });

  async function makeUnderReviewCampaign() {
    const creator = seedUser(userRepo, 'creator_001');
    const reviewer = seedUser(userRepo, 'reviewer_001', { roles: [Role.Reviewer, Role.Backer] });
    const campaign = Campaign.create({ creatorUserId: creator.id, title: 'Camp' });
    await campaignRepo.save(campaign);
    await campaignRepo.updateStatus(campaign.id, 'draft', 'submitted', { submittedAt: new Date() });
    await campaignRepo.updateStatus(campaign.id, 'submitted', 'under_review', { reviewedByUserId: reviewer.id });
    return { campaign, reviewer };
  }

  it('approves a campaign under review', async () => {
    const { campaign } = await makeUnderReviewCampaign();
    const approved = await service.approveCampaign('reviewer_001', campaign.id, 'Great work!');

    expect(approved.status).toBe('approved');
    expect(approved.reviewNotes).toBe('Great work!');
    expect(approved.reviewedAt).toBeInstanceOf(Date);
  });

  it('throws NotAssignedReviewerError for wrong reviewer', async () => {
    const { campaign } = await makeUnderReviewCampaign();
    seedUser(userRepo, 'reviewer_002', { roles: [Role.Reviewer, Role.Backer] });

    await expect(
      service.approveCampaign('reviewer_002', campaign.id, 'Notes'),
    ).rejects.toThrow(NotAssignedReviewerError);
  });

  it('throws CampaignNotApprovableError for non-under_review campaign', async () => {
    const creator = seedUser(userRepo, 'creator_001');
    seedUser(userRepo, 'reviewer_001', { roles: [Role.Reviewer, Role.Backer] });
    const campaign = Campaign.create({ creatorUserId: creator.id, title: 'Camp' });
    await campaignRepo.save(campaign);

    await expect(
      service.approveCampaign('reviewer_001', campaign.id, 'Notes'),
    ).rejects.toThrow(CampaignNotApprovableError);
  });
});

describe('CampaignAppService.rejectCampaign()', () => {
  let userRepo: InMemoryUserRepository;
  let campaignRepo: InMemoryCampaignRepository;
  let auditRepo: InMemoryCampaignAuditRepository;
  let service: CampaignAppService;

  beforeEach(() => {
    userRepo = new InMemoryUserRepository();
    campaignRepo = new InMemoryCampaignRepository();
    auditRepo = new InMemoryCampaignAuditRepository();
    service = new CampaignAppService(campaignRepo, auditRepo, userRepo, logger);
  });

  it('rejects a campaign under review', async () => {
    const creator = seedUser(userRepo, 'creator_001');
    const reviewer = seedUser(userRepo, 'reviewer_001', { roles: [Role.Reviewer, Role.Backer] });
    const campaign = Campaign.create({ creatorUserId: creator.id, title: 'Camp' });
    await campaignRepo.save(campaign);
    await campaignRepo.updateStatus(campaign.id, 'draft', 'submitted', { submittedAt: new Date() });
    await campaignRepo.updateStatus(campaign.id, 'submitted', 'under_review', { reviewedByUserId: reviewer.id });

    const rejected = await service.rejectCampaign(
      'reviewer_001',
      campaign.id,
      'Missing details',
      'Please add risk disclosures',
    );

    expect(rejected.status).toBe('rejected');
    expect(rejected.rejectionReason).toBe('Missing details');
    expect(rejected.resubmissionGuidance).toBe('Please add risk disclosures');
  });

  it('throws CampaignNotRejectableError for non-under_review campaign', async () => {
    const creator = seedUser(userRepo, 'creator_001');
    seedUser(userRepo, 'reviewer_001', { roles: [Role.Reviewer, Role.Backer] });
    const campaign = Campaign.create({ creatorUserId: creator.id, title: 'Camp' });
    await campaignRepo.save(campaign);

    await expect(
      service.rejectCampaign('reviewer_001', campaign.id, 'Reason', 'Guidance'),
    ).rejects.toThrow(CampaignNotRejectableError);
  });
});

describe('CampaignAppService.launchCampaign()', () => {
  let userRepo: InMemoryUserRepository;
  let campaignRepo: InMemoryCampaignRepository;
  let auditRepo: InMemoryCampaignAuditRepository;
  let service: CampaignAppService;

  beforeEach(() => {
    userRepo = new InMemoryUserRepository();
    campaignRepo = new InMemoryCampaignRepository();
    auditRepo = new InMemoryCampaignAuditRepository();
    service = new CampaignAppService(campaignRepo, auditRepo, userRepo, logger);
  });

  it('launches an approved campaign', async () => {
    const user = seedUser(userRepo, 'creator_001');
    const campaign = Campaign.create({ creatorUserId: user.id, title: 'Camp' });
    await campaignRepo.save(campaign);
    await campaignRepo.updateStatus(campaign.id, 'draft', 'submitted', { submittedAt: new Date() });
    await campaignRepo.updateStatus(campaign.id, 'submitted', 'under_review', { reviewedByUserId: user.id });
    await campaignRepo.updateStatus(campaign.id, 'under_review', 'approved', { reviewNotes: 'OK', reviewedAt: new Date() });

    const live = await service.launchCampaign('creator_001', campaign.id);
    expect(live.status).toBe('live');
    expect(live.launchedAt).toBeInstanceOf(Date);
  });

  it('throws CampaignNotLaunchableError for non-approved campaign', async () => {
    const user = seedUser(userRepo, 'creator_001');
    const campaign = Campaign.create({ creatorUserId: user.id, title: 'Camp' });
    await campaignRepo.save(campaign);

    await expect(service.launchCampaign('creator_001', campaign.id)).rejects.toThrow(
      CampaignNotLaunchableError,
    );
  });
});

describe('CampaignAppService.archiveCampaign()', () => {
  let userRepo: InMemoryUserRepository;
  let campaignRepo: InMemoryCampaignRepository;
  let auditRepo: InMemoryCampaignAuditRepository;
  let service: CampaignAppService;

  beforeEach(() => {
    userRepo = new InMemoryUserRepository();
    campaignRepo = new InMemoryCampaignRepository();
    auditRepo = new InMemoryCampaignAuditRepository();
    service = new CampaignAppService(campaignRepo, auditRepo, userRepo, logger);
  });

  it('allows creator to archive a draft', async () => {
    const user = seedUser(userRepo, 'creator_001');
    const campaign = Campaign.create({ creatorUserId: user.id, title: 'Camp' });
    await campaignRepo.save(campaign);

    const archived = await service.archiveCampaign('creator_001', campaign.id);
    expect(archived.status).toBe('archived');
  });

  it('throws CampaignCannotArchiveError for creator archiving submitted campaign', async () => {
    const user = seedUser(userRepo, 'creator_001');
    const campaign = Campaign.create({ creatorUserId: user.id, title: 'Camp' });
    await campaignRepo.save(campaign);
    await campaignRepo.updateStatus(campaign.id, 'draft', 'submitted', { submittedAt: new Date() });

    await expect(service.archiveCampaign('creator_001', campaign.id)).rejects.toThrow(
      CampaignCannotArchiveError,
    );
  });

  it('allows admin to archive any campaign', async () => {
    const creator = seedUser(userRepo, 'creator_001');
    seedUser(userRepo, 'admin_001', { roles: [Role.Administrator, Role.Backer] });
    const campaign = Campaign.create({ creatorUserId: creator.id, title: 'Camp' });
    await campaignRepo.save(campaign);
    await campaignRepo.updateStatus(campaign.id, 'draft', 'submitted', { submittedAt: new Date() });

    const archived = await service.archiveCampaign('admin_001', campaign.id);
    expect(archived.status).toBe('archived');
  });
});

describe('CampaignAppService.reassignReviewer()', () => {
  let userRepo: InMemoryUserRepository;
  let campaignRepo: InMemoryCampaignRepository;
  let auditRepo: InMemoryCampaignAuditRepository;
  let service: CampaignAppService;

  beforeEach(() => {
    userRepo = new InMemoryUserRepository();
    campaignRepo = new InMemoryCampaignRepository();
    auditRepo = new InMemoryCampaignAuditRepository();
    service = new CampaignAppService(campaignRepo, auditRepo, userRepo, logger);
  });

  it('reassigns reviewer successfully', async () => {
    const creator = seedUser(userRepo, 'creator_001');
    const reviewer1 = seedUser(userRepo, 'reviewer_001', { roles: [Role.Reviewer, Role.Backer] });
    const reviewer2 = seedUser(userRepo, 'reviewer_002', { roles: [Role.Reviewer, Role.Backer] });
    seedUser(userRepo, 'admin_001', { roles: [Role.Administrator, Role.Backer] });

    const campaign = Campaign.create({ creatorUserId: creator.id, title: 'Camp' });
    await campaignRepo.save(campaign);
    await campaignRepo.updateStatus(campaign.id, 'draft', 'submitted', { submittedAt: new Date() });
    await campaignRepo.updateStatus(campaign.id, 'submitted', 'under_review', { reviewedByUserId: reviewer1.id });

    const reassigned = await service.reassignReviewer('admin_001', campaign.id, reviewer2.id);
    expect(reassigned.reviewedByUserId).toBe(reviewer2.id);
  });

  it('throws AdminRoleRequiredError for non-admin', async () => {
    const creator = seedUser(userRepo, 'creator_001');
    const reviewer = seedUser(userRepo, 'reviewer_001', { roles: [Role.Reviewer, Role.Backer] });
    const campaign = Campaign.create({ creatorUserId: creator.id, title: 'Camp' });
    await campaignRepo.save(campaign);
    await campaignRepo.updateStatus(campaign.id, 'draft', 'submitted', { submittedAt: new Date() });
    await campaignRepo.updateStatus(campaign.id, 'submitted', 'under_review', { reviewedByUserId: reviewer.id });

    await expect(
      service.reassignReviewer('reviewer_001', campaign.id, reviewer.id),
    ).rejects.toThrow(AdminRoleRequiredError);
  });

  it('throws CampaignInvalidStateError for non-under_review campaign', async () => {
    const creator = seedUser(userRepo, 'creator_001');
    seedUser(userRepo, 'admin_001', { roles: [Role.Administrator, Role.Backer] });
    const reviewer2 = seedUser(userRepo, 'reviewer_002', { roles: [Role.Reviewer, Role.Backer] });
    const campaign = Campaign.create({ creatorUserId: creator.id, title: 'Camp' });
    await campaignRepo.save(campaign);

    await expect(
      service.reassignReviewer('admin_001', campaign.id, reviewer2.id),
    ).rejects.toThrow(CampaignInvalidStateError);
  });

  it('throws ReassignTargetNotReviewerError for non-reviewer target', async () => {
    const creator = seedUser(userRepo, 'creator_001');
    const reviewer = seedUser(userRepo, 'reviewer_001', { roles: [Role.Reviewer, Role.Backer] });
    const backer = seedUser(userRepo, 'backer_001', { roles: [Role.Backer] });
    seedUser(userRepo, 'admin_001', { roles: [Role.Administrator, Role.Backer] });

    const campaign = Campaign.create({ creatorUserId: creator.id, title: 'Camp' });
    await campaignRepo.save(campaign);
    await campaignRepo.updateStatus(campaign.id, 'draft', 'submitted', { submittedAt: new Date() });
    await campaignRepo.updateStatus(campaign.id, 'submitted', 'under_review', { reviewedByUserId: reviewer.id });

    await expect(
      service.reassignReviewer('admin_001', campaign.id, backer.id),
    ).rejects.toThrow(ReassignTargetNotReviewerError);
  });
});
