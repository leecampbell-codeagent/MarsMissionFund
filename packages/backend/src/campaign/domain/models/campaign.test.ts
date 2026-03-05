import { describe, expect, it } from 'vitest';
import {
  CampaignNotApprovableError,
  CampaignNotClaimableError,
  CampaignNotEditableError,
  CampaignNotLaunchableError,
  CampaignNotRejectableError,
  CampaignNotSubmittableError,
  CampaignTitleTooLongError,
  InvalidCampaignTitleError,
  InvalidCreatorIdError,
} from '../errors/campaign-errors.js';
import type { CampaignData } from './campaign.js';
import { Campaign } from './campaign.js';

const VALID_CREATOR_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const VALID_TITLE = 'HelioShield: Advanced Radiation Protection for Mars Crews';

function makeDraft(overrides: Partial<Pick<CampaignData, 'title' | 'creatorUserId'>> = {}) {
  return Campaign.create({
    creatorUserId: overrides.creatorUserId ?? VALID_CREATOR_ID,
    title: overrides.title ?? VALID_TITLE,
  });
}

function makeSubmittedCampaignData(): CampaignData {
  return {
    id: 'campaign-001',
    creatorUserId: VALID_CREATOR_ID,
    title: VALID_TITLE,
    shortDescription: 'A short description.',
    description: 'A full description.',
    category: 'radiation_protection',
    heroImageUrl: null,
    fundingGoalCents: '150000000',
    fundingCapCents: '200000000',
    deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    milestones: [
      {
        id: 'ms-1',
        title: 'Phase 1',
        description: 'First',
        fundingBasisPoints: 5000,
        targetDate: '2026-06-01',
      },
      {
        id: 'ms-2',
        title: 'Phase 2',
        description: 'Second',
        fundingBasisPoints: 5000,
        targetDate: '2026-12-01',
      },
    ],
    teamMembers: [{ id: 'tm-1', name: 'Dr. Ada', role: 'Lead', bio: 'Expert' }],
    riskDisclosures: [{ id: 'rd-1', risk: 'Radiation', mitigation: 'Shielding' }],
    budgetBreakdown: [],
    alignmentStatement: 'This mission directly advances...',
    tags: ['radiation', 'protection'],
    status: 'submitted',
    rejectionReason: null,
    resubmissionGuidance: null,
    reviewNotes: null,
    reviewedByUserId: null,
    reviewedAt: null,
    submittedAt: new Date('2026-03-05T10:00:00Z'),
    launchedAt: null,
    createdAt: new Date('2026-03-01T10:00:00Z'),
    updatedAt: new Date('2026-03-05T10:00:00Z'),
  };
}

describe('Campaign.create()', () => {
  it('creates a draft campaign with valid inputs', () => {
    const campaign = makeDraft();

    expect(campaign.id).toBeDefined();
    expect(campaign.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(campaign.creatorUserId).toBe(VALID_CREATOR_ID);
    expect(campaign.title).toBe(VALID_TITLE);
    expect(campaign.status).toBe('draft');
    expect(campaign.shortDescription).toBeNull();
    expect(campaign.description).toBeNull();
    expect(campaign.category).toBeNull();
    expect(campaign.milestones).toEqual([]);
    expect(campaign.teamMembers).toEqual([]);
    expect(campaign.riskDisclosures).toEqual([]);
    expect(campaign.budgetBreakdown).toEqual([]);
    expect(campaign.tags).toEqual([]);
    expect(campaign.rejectionReason).toBeNull();
    expect(campaign.reviewedByUserId).toBeNull();
    expect(campaign.submittedAt).toBeNull();
    expect(campaign.launchedAt).toBeNull();
  });

  it('trims the title', () => {
    const campaign = Campaign.create({
      creatorUserId: VALID_CREATOR_ID,
      title: '  Mars Shield  ',
    });
    expect(campaign.title).toBe('Mars Shield');
  });

  it('throws InvalidCampaignTitleError for empty title', () => {
    expect(() => Campaign.create({ creatorUserId: VALID_CREATOR_ID, title: '' })).toThrow(
      InvalidCampaignTitleError,
    );
  });

  it('throws InvalidCampaignTitleError for whitespace-only title', () => {
    expect(() => Campaign.create({ creatorUserId: VALID_CREATOR_ID, title: '   ' })).toThrow(
      InvalidCampaignTitleError,
    );
  });

  it('throws CampaignTitleTooLongError for title > 200 chars', () => {
    expect(() =>
      Campaign.create({
        creatorUserId: VALID_CREATOR_ID,
        title: 'a'.repeat(201),
      }),
    ).toThrow(CampaignTitleTooLongError);
  });

  it('accepts title of exactly 200 chars', () => {
    const campaign = Campaign.create({
      creatorUserId: VALID_CREATOR_ID,
      title: 'a'.repeat(200),
    });
    expect(campaign.title.length).toBe(200);
  });

  it('throws InvalidCreatorIdError for empty creatorUserId', () => {
    expect(() => Campaign.create({ creatorUserId: '', title: VALID_TITLE })).toThrow(
      InvalidCreatorIdError,
    );
  });
});

describe('Campaign.reconstitute()', () => {
  it('reconstitutes a campaign from data without validation', () => {
    const data = makeSubmittedCampaignData();
    const campaign = Campaign.reconstitute(data);

    expect(campaign.id).toBe('campaign-001');
    expect(campaign.status).toBe('submitted');
    expect(campaign.title).toBe(VALID_TITLE);
  });
});

describe('Campaign.updateDraft()', () => {
  it('updates provided fields and returns new instance', () => {
    const draft = makeDraft();
    const updated = draft.updateDraft({ title: 'New Title', description: 'New desc' });

    expect(updated.title).toBe('New Title');
    expect(updated.description).toBe('New desc');
    expect(updated.status).toBe('draft');
    // Original unchanged
    expect(draft.title).toBe(VALID_TITLE);
    expect(draft.description).toBeNull();
  });

  it('only updates provided fields (partial update)', () => {
    const draft = Campaign.reconstitute({
      ...makeSubmittedCampaignData(),
      status: 'draft',
      submittedAt: null,
    });
    const updated = draft.updateDraft({ title: 'New Title' });

    expect(updated.title).toBe('New Title');
    expect(updated.description).toBe('A full description.'); // unchanged
  });

  it('throws CampaignNotEditableError for submitted status', () => {
    const campaign = Campaign.reconstitute(makeSubmittedCampaignData());
    expect(() => campaign.updateDraft({ title: 'X' })).toThrow(CampaignNotEditableError);
  });

  it('throws CampaignNotEditableError for under_review status', () => {
    const campaign = Campaign.reconstitute({
      ...makeSubmittedCampaignData(),
      status: 'under_review',
    });
    expect(() => campaign.updateDraft({ title: 'X' })).toThrow(CampaignNotEditableError);
  });

  it('allows editing rejected campaigns', () => {
    const campaign = Campaign.reconstitute({
      ...makeSubmittedCampaignData(),
      status: 'rejected',
      submittedAt: new Date(),
    });
    const updated = campaign.updateDraft({ title: 'Revised Title' });
    expect(updated.title).toBe('Revised Title');
  });
});

describe('Campaign.submit()', () => {
  it('transitions draft to submitted', () => {
    const draft = makeDraft();
    const now = new Date();
    const submitted = draft.submit(now);

    expect(submitted.status).toBe('submitted');
    expect(submitted.submittedAt).toBe(now);
  });

  it('throws CampaignNotSubmittableError for under_review status', () => {
    const campaign = Campaign.reconstitute({
      ...makeSubmittedCampaignData(),
      status: 'under_review',
    });
    expect(() => campaign.submit(new Date())).toThrow(CampaignNotSubmittableError);
  });

  it('allows resubmission from rejected status', () => {
    const campaign = Campaign.reconstitute({
      ...makeSubmittedCampaignData(),
      status: 'rejected',
    });
    const resubmitted = campaign.submit(new Date());
    expect(resubmitted.status).toBe('submitted');
  });
});

describe('Campaign.claim()', () => {
  it('transitions submitted to under_review with reviewer', () => {
    const campaign = Campaign.reconstitute(makeSubmittedCampaignData());
    const reviewerId = 'reviewer-uuid-123';
    const claimedAt = new Date();
    const claimed = campaign.claim(reviewerId, claimedAt);

    expect(claimed.status).toBe('under_review');
    expect(claimed.reviewedByUserId).toBe(reviewerId);
  });

  it('throws CampaignNotClaimableError for non-submitted campaign', () => {
    const draft = makeDraft();
    expect(() => draft.claim('reviewer', new Date())).toThrow(CampaignNotClaimableError);
  });
});

describe('Campaign.approve()', () => {
  it('transitions under_review to approved', () => {
    const campaign = Campaign.reconstitute({
      ...makeSubmittedCampaignData(),
      status: 'under_review',
      reviewedByUserId: 'reviewer-id',
    });
    const reviewed = campaign.approve('Looks great!', new Date());

    expect(reviewed.status).toBe('approved');
    expect(reviewed.reviewNotes).toBe('Looks great!');
    expect(reviewed.reviewedAt).toBeInstanceOf(Date);
  });

  it('throws CampaignNotApprovableError for non-under_review campaign', () => {
    const campaign = Campaign.reconstitute(makeSubmittedCampaignData());
    expect(() => campaign.approve('Notes', new Date())).toThrow(CampaignNotApprovableError);
  });
});

describe('Campaign.reject()', () => {
  it('transitions under_review to rejected', () => {
    const campaign = Campaign.reconstitute({
      ...makeSubmittedCampaignData(),
      status: 'under_review',
      reviewedByUserId: 'reviewer-id',
    });
    const rejected = campaign.reject('Needs work', 'Fix the milestones', new Date());

    expect(rejected.status).toBe('rejected');
    expect(rejected.rejectionReason).toBe('Needs work');
    expect(rejected.resubmissionGuidance).toBe('Fix the milestones');
    expect(rejected.reviewedAt).toBeInstanceOf(Date);
  });

  it('throws CampaignNotRejectableError for non-under_review campaign', () => {
    const campaign = Campaign.reconstitute(makeSubmittedCampaignData());
    expect(() => campaign.reject('Reason', 'Guidance', new Date())).toThrow(
      CampaignNotRejectableError,
    );
  });
});

describe('Campaign.launch()', () => {
  it('transitions approved to live', () => {
    const campaign = Campaign.reconstitute({
      ...makeSubmittedCampaignData(),
      status: 'approved',
      reviewNotes: 'Approved',
      reviewedAt: new Date(),
    });
    const launchedAt = new Date();
    const live = campaign.launch(launchedAt);

    expect(live.status).toBe('live');
    expect(live.launchedAt).toBe(launchedAt);
  });

  it('throws CampaignNotLaunchableError for non-approved campaign', () => {
    const campaign = Campaign.reconstitute(makeSubmittedCampaignData());
    expect(() => campaign.launch(new Date())).toThrow(CampaignNotLaunchableError);
  });
});

describe('Campaign.archive()', () => {
  it('archives a draft campaign', () => {
    const campaign = makeDraft();
    const archived = campaign.archive();
    expect(archived.status).toBe('archived');
  });

  it('archives a rejected campaign', () => {
    const campaign = Campaign.reconstitute({
      ...makeSubmittedCampaignData(),
      status: 'rejected',
    });
    const archived = campaign.archive();
    expect(archived.status).toBe('archived');
  });

  it('archives any status (business rule enforced by app service, not entity)', () => {
    // The entity itself does not throw — the app service enforces the access rules
    const campaign = Campaign.reconstitute({
      ...makeSubmittedCampaignData(),
      status: 'live',
    });
    const archived = campaign.archive();
    expect(archived.status).toBe('archived');
  });
});
