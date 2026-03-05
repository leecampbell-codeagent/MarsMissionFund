import { describe, expect, it } from 'vitest';
import {
  Campaign,
  MIN_FUNDING_TARGET_CENTS,
  MAX_FUNDING_TARGET_CENTS,
} from '../domain/campaign.js';
import {
  CampaignAlreadySubmittedError,
  CampaignNotReviewableError,
  InvalidCampaignError,
  ReviewerCommentRequiredError,
} from '../domain/errors.js';
import { Milestone } from '../domain/milestone.js';

// ─── Helper builders ──────────────────────────────────────────────────────────

function makeValidDraft(overrides: Partial<Parameters<typeof Campaign.create>[0]> = {}) {
  return Campaign.create({
    creatorId: 'creator-001',
    title: 'Advanced Propulsion System',
    category: 'propulsion',
    minFundingTargetCents: 150_000_000, // $1.5M
    maxFundingCapCents: 500_000_000,   // $5M
    ...overrides,
  });
}

function makeValidMilestones(campaignId: string, count = 2): Milestone[] {
  const pct = Math.floor(100 / count);
  const remainder = 100 - pct * count;
  return Array.from({ length: count }, (_, i) =>
    Milestone.create({
      campaignId,
      title: `Milestone ${i + 1}`,
      targetDate: new Date(Date.now() + (i + 1) * 30 * 24 * 60 * 60 * 1000),
      fundingPercentage: i === count - 1 ? pct + remainder : pct,
    }),
  );
}

function makeFullyValidDraft(): Campaign {
  return Campaign.create({
    creatorId: 'creator-001',
    title: 'Advanced Propulsion System',
    category: 'propulsion',
    minFundingTargetCents: 150_000_000,
    maxFundingCapCents: 500_000_000,
    summary: 'A revolutionary ion drive for faster Mars transit.',
    description: 'We are building a next-generation ion propulsion system.',
    marsAlignmentStatement: 'This technology will cut Earth-Mars transit time by 40%.',
    deadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
    teamInfo: JSON.stringify([{ name: 'Dr. Jane Smith', role: 'Lead Engineer' }]),
    riskDisclosures: JSON.stringify([{ risk: 'Technical failure', mitigation: 'Redundant systems' }]),
  });
}

// ─── Campaign.create() ────────────────────────────────────────────────────────

describe('Campaign.create()', () => {
  it('creates a campaign in draft status', () => {
    const campaign = makeValidDraft();
    expect(campaign.status).toBe('draft');
    expect(campaign.isDraft()).toBe(true);
    expect(campaign.id).toBeTruthy();
  });

  it('trims and stores title', () => {
    const campaign = makeValidDraft({ title: '  Ion Drive Project  ' });
    expect(campaign.title).toBe('Ion Drive Project');
  });

  it('throws InvalidCampaignError for empty title', () => {
    expect(() => makeValidDraft({ title: '' })).toThrow(InvalidCampaignError);
    expect(() => makeValidDraft({ title: '   ' })).toThrow(InvalidCampaignError);
  });

  it('throws InvalidCampaignError for title over 200 chars', () => {
    expect(() => makeValidDraft({ title: 'A'.repeat(201) })).toThrow(InvalidCampaignError);
  });

  it('throws InvalidCampaignError for invalid category', () => {
    expect(() =>
      makeValidDraft({ category: 'invalid_cat' as 'propulsion' }),
    ).toThrow(InvalidCampaignError);
  });

  it('throws InvalidCampaignError when maxFundingCap < minFundingTarget', () => {
    expect(() =>
      makeValidDraft({
        minFundingTargetCents: 200_000_000,
        maxFundingCapCents: 100_000_000,
      }),
    ).toThrow(InvalidCampaignError);
  });

  it('throws InvalidCampaignError for non-positive minFundingTarget', () => {
    expect(() => makeValidDraft({ minFundingTargetCents: 0 })).toThrow(InvalidCampaignError);
    expect(() => makeValidDraft({ minFundingTargetCents: -1 })).toThrow(InvalidCampaignError);
  });

  it('throws InvalidCampaignError for empty creatorId', () => {
    expect(() => makeValidDraft({ creatorId: '' })).toThrow(InvalidCampaignError);
    expect(() => makeValidDraft({ creatorId: '   ' })).toThrow(InvalidCampaignError);
  });

  it('stores optional fields as null when not provided', () => {
    const campaign = makeValidDraft();
    expect(campaign.summary).toBeNull();
    expect(campaign.description).toBeNull();
    expect(campaign.deadline).toBeNull();
    expect(campaign.heroImageUrl).toBeNull();
  });
});

// ─── Campaign.withDraftUpdate() ───────────────────────────────────────────────

describe('Campaign.withDraftUpdate()', () => {
  it('returns new Campaign with updated fields', () => {
    const campaign = makeValidDraft();
    const updated = campaign.withDraftUpdate({ summary: 'New summary', description: 'New desc' });
    expect(updated.summary).toBe('New summary');
    expect(updated.description).toBe('New desc');
    expect(updated.title).toBe(campaign.title); // unchanged
  });

  it('throws CampaignAlreadySubmittedError when not in draft status', () => {
    const campaign = Campaign.reconstitute({
      id: 'c-001',
      creatorId: 'u-001',
      title: 'Test',
      summary: 'summary',
      description: 'desc',
      marsAlignmentStatement: 'alignment',
      category: 'propulsion',
      status: 'submitted',
      minFundingTargetCents: 150_000_000,
      maxFundingCapCents: 500_000_000,
      deadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      budgetBreakdown: null,
      teamInfo: JSON.stringify([{ name: 'Jane' }]),
      riskDisclosures: JSON.stringify([{ risk: 'some risk' }]),
      heroImageUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(() => campaign.withDraftUpdate({ title: 'New title' })).toThrow(
      CampaignAlreadySubmittedError,
    );
  });

  it('throws InvalidCampaignError for empty title', () => {
    const campaign = makeValidDraft();
    expect(() => campaign.withDraftUpdate({ title: '' })).toThrow(InvalidCampaignError);
  });

  it('throws InvalidCampaignError when maxCap becomes less than minTarget after update', () => {
    const campaign = makeValidDraft({
      minFundingTargetCents: 200_000_000,
      maxFundingCapCents: 500_000_000,
    });
    expect(() =>
      campaign.withDraftUpdate({ maxFundingCapCents: 100_000_000 }),
    ).toThrow(InvalidCampaignError);
  });
});

// ─── Campaign.submit() ────────────────────────────────────────────────────────

describe('Campaign.submit()', () => {
  it('transitions to submitted status with valid data', () => {
    const campaign = makeFullyValidDraft();
    const milestones = makeValidMilestones(campaign.id);
    const submitted = campaign.submit({ milestones });
    expect(submitted.status).toBe('submitted');
    expect(submitted.isSubmitted()).toBe(true);
  });

  it('throws CampaignAlreadySubmittedError if already submitted', () => {
    const campaign = makeFullyValidDraft();
    const milestones = makeValidMilestones(campaign.id);
    const submitted = campaign.submit({ milestones });
    expect(() => submitted.submit({ milestones })).toThrow(CampaignAlreadySubmittedError);
  });

  it('throws InvalidCampaignError if summary is missing', () => {
    const campaign = makeValidDraft({
      description: 'desc',
      marsAlignmentStatement: 'alignment',
      deadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      teamInfo: JSON.stringify([{ name: 'Jane' }]),
      riskDisclosures: JSON.stringify([{ risk: 'some risk' }]),
      minFundingTargetCents: MIN_FUNDING_TARGET_CENTS,
      maxFundingCapCents: MIN_FUNDING_TARGET_CENTS * 2,
    });
    const milestones = makeValidMilestones(campaign.id);
    expect(() => campaign.submit({ milestones })).toThrow(InvalidCampaignError);
  });

  it('throws InvalidCampaignError if minFundingTarget is below $1M', () => {
    const campaign = Campaign.reconstitute({
      id: 'c-001',
      creatorId: 'u-001',
      title: 'Test',
      summary: 'summary',
      description: 'desc',
      marsAlignmentStatement: 'alignment',
      category: 'propulsion',
      status: 'draft',
      minFundingTargetCents: 50_000_000, // $500K — too low
      maxFundingCapCents: 100_000_000,
      deadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      budgetBreakdown: null,
      teamInfo: JSON.stringify([{ name: 'Jane' }]),
      riskDisclosures: JSON.stringify([{ risk: 'some risk' }]),
      heroImageUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const milestones = makeValidMilestones(campaign.id);
    expect(() => campaign.submit({ milestones })).toThrow(InvalidCampaignError);
  });

  it('throws InvalidCampaignError if minFundingTarget exceeds $1B', () => {
    const campaign = Campaign.reconstitute({
      id: 'c-001',
      creatorId: 'u-001',
      title: 'Test',
      summary: 'summary',
      description: 'desc',
      marsAlignmentStatement: 'alignment',
      category: 'propulsion',
      status: 'draft',
      minFundingTargetCents: MAX_FUNDING_TARGET_CENTS + 1,
      maxFundingCapCents: MAX_FUNDING_TARGET_CENTS + 2,
      deadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      budgetBreakdown: null,
      teamInfo: JSON.stringify([{ name: 'Jane' }]),
      riskDisclosures: JSON.stringify([{ risk: 'some risk' }]),
      heroImageUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const milestones = makeValidMilestones(campaign.id);
    expect(() => campaign.submit({ milestones })).toThrow(InvalidCampaignError);
  });

  it('throws InvalidCampaignError if deadline is less than 7 days away', () => {
    const campaign = makeFullyValidDraft();
    const shortDeadlineCampaign = campaign.withDraftUpdate({
      deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
    });
    const milestones = makeValidMilestones(campaign.id);
    expect(() => shortDeadlineCampaign.submit({ milestones })).toThrow(InvalidCampaignError);
  });

  it('throws InvalidCampaignError if deadline is more than 365 days away', () => {
    const campaign = makeFullyValidDraft();
    const farDeadlineCampaign = campaign.withDraftUpdate({
      deadline: new Date(Date.now() + 400 * 24 * 60 * 60 * 1000), // 400 days
    });
    const milestones = makeValidMilestones(campaign.id);
    expect(() => farDeadlineCampaign.submit({ milestones })).toThrow(InvalidCampaignError);
  });

  it('throws InvalidCampaignError when fewer than 2 milestones', () => {
    const campaign = makeFullyValidDraft();
    const oneMilestone = [
      Milestone.create({
        campaignId: campaign.id,
        title: 'Only Milestone',
        targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        fundingPercentage: 100,
      }),
    ];
    expect(() => campaign.submit({ milestones: oneMilestone })).toThrow(InvalidCampaignError);
  });

  it('throws InvalidCampaignError when milestone percentages do not sum to 100', () => {
    const campaign = makeFullyValidDraft();
    const milestones = [
      Milestone.create({ campaignId: campaign.id, title: 'M1', targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), fundingPercentage: 40 }),
      Milestone.create({ campaignId: campaign.id, title: 'M2', targetDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), fundingPercentage: 40 }),
    ];
    expect(() => campaign.submit({ milestones })).toThrow(InvalidCampaignError);
  });

  it('throws InvalidCampaignError when milestone percentages sum to 99', () => {
    const campaign = makeFullyValidDraft();
    const milestones = [
      Milestone.create({ campaignId: campaign.id, title: 'M1', targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), fundingPercentage: 49 }),
      Milestone.create({ campaignId: campaign.id, title: 'M2', targetDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), fundingPercentage: 50 }),
    ];
    expect(() => campaign.submit({ milestones })).toThrow(InvalidCampaignError);
  });

  it('throws InvalidCampaignError when no team info', () => {
    const campaign = Campaign.reconstitute({
      id: 'c-001',
      creatorId: 'u-001',
      title: 'Test',
      summary: 'summary',
      description: 'desc',
      marsAlignmentStatement: 'alignment',
      category: 'propulsion',
      status: 'draft',
      minFundingTargetCents: MIN_FUNDING_TARGET_CENTS,
      maxFundingCapCents: MIN_FUNDING_TARGET_CENTS * 2,
      deadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      budgetBreakdown: null,
      teamInfo: null,
      riskDisclosures: JSON.stringify([{ risk: 'some risk' }]),
      heroImageUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const milestones = makeValidMilestones(campaign.id);
    expect(() => campaign.submit({ milestones })).toThrow(InvalidCampaignError);
  });

  it('throws InvalidCampaignError when no risk disclosures', () => {
    const campaign = Campaign.reconstitute({
      id: 'c-001',
      creatorId: 'u-001',
      title: 'Test',
      summary: 'summary',
      description: 'desc',
      marsAlignmentStatement: 'alignment',
      category: 'propulsion',
      status: 'draft',
      minFundingTargetCents: MIN_FUNDING_TARGET_CENTS,
      maxFundingCapCents: MIN_FUNDING_TARGET_CENTS * 2,
      deadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      budgetBreakdown: null,
      teamInfo: JSON.stringify([{ name: 'Jane' }]),
      riskDisclosures: null,
      heroImageUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const milestones = makeValidMilestones(campaign.id);
    expect(() => campaign.submit({ milestones })).toThrow(InvalidCampaignError);
  });

  it('accepts exactly $1M funding target', () => {
    const campaign = Campaign.reconstitute({
      id: 'c-001',
      creatorId: 'u-001',
      title: 'Test',
      summary: 'summary',
      description: 'desc',
      marsAlignmentStatement: 'alignment',
      category: 'propulsion',
      status: 'draft',
      minFundingTargetCents: MIN_FUNDING_TARGET_CENTS,
      maxFundingCapCents: MIN_FUNDING_TARGET_CENTS,
      deadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      budgetBreakdown: null,
      teamInfo: JSON.stringify([{ name: 'Jane' }]),
      riskDisclosures: JSON.stringify([{ risk: 'some risk' }]),
      heroImageUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const milestones = makeValidMilestones(campaign.id);
    const submitted = campaign.submit({ milestones });
    expect(submitted.status).toBe('submitted');
  });

  it('accepts deadline exactly 7 days from now', () => {
    const campaign = makeFullyValidDraft();
    const sevenDays = campaign.withDraftUpdate({
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 1000), // 7 days + 1 second
    });
    const milestones = makeValidMilestones(campaign.id);
    expect(() => sevenDays.submit({ milestones })).not.toThrow();
  });
});

// ─── Review Pipeline Domain Tests ─────────────────────────────────────────────

function makeSubmittedCampaign(): Campaign {
  return Campaign.reconstitute({
    id: 'c-submitted',
    creatorId: 'creator-001',
    title: 'Test Campaign',
    summary: 'summary',
    description: 'desc',
    marsAlignmentStatement: 'alignment',
    category: 'propulsion',
    status: 'submitted',
    minFundingTargetCents: 150_000_000,
    maxFundingCapCents: 500_000_000,
    deadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    budgetBreakdown: null,
    teamInfo: JSON.stringify([{ name: 'Jane' }]),
    riskDisclosures: JSON.stringify([{ risk: 'some risk' }]),
    heroImageUrl: null,
    reviewerId: null,
    reviewerComment: null,
    reviewedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function makeUnderReviewCampaign(reviewerId = 'reviewer-001'): Campaign {
  return Campaign.reconstitute({
    id: 'c-under-review',
    creatorId: 'creator-001',
    title: 'Test Campaign',
    summary: 'summary',
    description: 'desc',
    marsAlignmentStatement: 'alignment',
    category: 'propulsion',
    status: 'under_review',
    minFundingTargetCents: 150_000_000,
    maxFundingCapCents: 500_000_000,
    deadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    budgetBreakdown: null,
    teamInfo: JSON.stringify([{ name: 'Jane' }]),
    riskDisclosures: JSON.stringify([{ risk: 'some risk' }]),
    heroImageUrl: null,
    reviewerId,
    reviewerComment: null,
    reviewedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe('Campaign.startReview()', () => {
  it('transitions submitted → under_review', () => {
    const campaign = makeSubmittedCampaign();
    const reviewed = campaign.startReview('reviewer-001');
    expect(reviewed.status).toBe('under_review');
    expect(reviewed.reviewerId).toBe('reviewer-001');
    expect(reviewed.reviewedAt).toBeInstanceOf(Date);
  });

  it('throws CampaignNotReviewableError if not submitted', () => {
    const campaign = makeUnderReviewCampaign();
    expect(() => campaign.startReview('reviewer-002')).toThrow(CampaignNotReviewableError);
  });

  it('throws CampaignNotReviewableError if draft', () => {
    const campaign = makeValidDraft();
    expect(() => campaign.startReview('reviewer-001')).toThrow(CampaignNotReviewableError);
  });

  it('accepts a custom reviewedAt timestamp', () => {
    const campaign = makeSubmittedCampaign();
    const ts = new Date('2026-03-05T10:00:00Z');
    const reviewed = campaign.startReview('reviewer-001', ts);
    expect(reviewed.reviewedAt?.toISOString()).toBe(ts.toISOString());
  });
});

describe('Campaign.approve()', () => {
  it('transitions under_review → approved with comment', () => {
    const campaign = makeUnderReviewCampaign('reviewer-001');
    const approved = campaign.approve('reviewer-001', 'Excellent Mars alignment and feasible plan.');
    expect(approved.status).toBe('approved');
    expect(approved.reviewerComment).toBe('Excellent Mars alignment and feasible plan.');
    expect(approved.reviewedAt).toBeInstanceOf(Date);
  });

  it('throws CampaignNotReviewableError if not under_review', () => {
    const campaign = makeSubmittedCampaign();
    expect(() => campaign.approve('reviewer-001', 'Great!')).toThrow(CampaignNotReviewableError);
  });

  it('throws CampaignNotReviewableError if wrong reviewer', () => {
    const campaign = makeUnderReviewCampaign('reviewer-001');
    expect(() => campaign.approve('reviewer-002', 'Great!')).toThrow(CampaignNotReviewableError);
  });

  it('throws ReviewerCommentRequiredError for empty comment', () => {
    const campaign = makeUnderReviewCampaign('reviewer-001');
    expect(() => campaign.approve('reviewer-001', '')).toThrow(ReviewerCommentRequiredError);
    expect(() => campaign.approve('reviewer-001', '   ')).toThrow(ReviewerCommentRequiredError);
  });

  it('trims the comment', () => {
    const campaign = makeUnderReviewCampaign('reviewer-001');
    const approved = campaign.approve('reviewer-001', '  Good campaign.  ');
    expect(approved.reviewerComment).toBe('Good campaign.');
  });
});

describe('Campaign.reject()', () => {
  it('transitions under_review → rejected with comment', () => {
    const campaign = makeUnderReviewCampaign('reviewer-001');
    const rejected = campaign.reject('reviewer-001', 'Missing team credentials and feasibility plan.');
    expect(rejected.status).toBe('rejected');
    expect(rejected.reviewerComment).toBe('Missing team credentials and feasibility plan.');
  });

  it('throws CampaignNotReviewableError if not under_review', () => {
    const campaign = makeSubmittedCampaign();
    expect(() => campaign.reject('reviewer-001', 'Not good.')).toThrow(CampaignNotReviewableError);
  });

  it('throws CampaignNotReviewableError if wrong reviewer', () => {
    const campaign = makeUnderReviewCampaign('reviewer-001');
    expect(() => campaign.reject('reviewer-002', 'Not good.')).toThrow(CampaignNotReviewableError);
  });

  it('throws ReviewerCommentRequiredError for empty comment', () => {
    const campaign = makeUnderReviewCampaign('reviewer-001');
    expect(() => campaign.reject('reviewer-001', '')).toThrow(ReviewerCommentRequiredError);
  });
});

describe('Campaign.recuse()', () => {
  it('transitions under_review → submitted and clears reviewer fields', () => {
    const campaign = makeUnderReviewCampaign('reviewer-001');
    const recused = campaign.recuse('reviewer-001');
    expect(recused.status).toBe('submitted');
    expect(recused.reviewerId).toBeNull();
    expect(recused.reviewerComment).toBeNull();
    expect(recused.reviewedAt).toBeNull();
  });

  it('throws CampaignNotReviewableError if not under_review', () => {
    const campaign = makeSubmittedCampaign();
    expect(() => campaign.recuse('reviewer-001')).toThrow(CampaignNotReviewableError);
  });

  it('throws CampaignNotReviewableError if wrong reviewer', () => {
    const campaign = makeUnderReviewCampaign('reviewer-001');
    expect(() => campaign.recuse('reviewer-002')).toThrow(CampaignNotReviewableError);
  });
});

describe('Campaign.returnToDraft()', () => {
  it('transitions rejected → draft and preserves data', () => {
    const rejectedCampaign = Campaign.reconstitute({
      id: 'c-rejected',
      creatorId: 'creator-001',
      title: 'My Campaign',
      summary: 'summary',
      description: 'desc',
      marsAlignmentStatement: 'alignment',
      category: 'propulsion',
      status: 'rejected',
      minFundingTargetCents: 150_000_000,
      maxFundingCapCents: 500_000_000,
      deadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      budgetBreakdown: null,
      teamInfo: JSON.stringify([{ name: 'Jane' }]),
      riskDisclosures: JSON.stringify([{ risk: 'some risk' }]),
      heroImageUrl: null,
      reviewerId: 'reviewer-001',
      reviewerComment: 'Needs work.',
      reviewedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const draft = rejectedCampaign.returnToDraft();
    expect(draft.status).toBe('draft');
    expect(draft.title).toBe('My Campaign'); // data preserved
    expect(draft.summary).toBe('summary');   // data preserved
    // Reviewer info preserved for audit history
    expect(draft.reviewerId).toBe('reviewer-001');
    expect(draft.reviewerComment).toBe('Needs work.');
  });

  it('throws CampaignNotReviewableError if not rejected', () => {
    const campaign = makeSubmittedCampaign();
    expect(() => campaign.returnToDraft()).toThrow(CampaignNotReviewableError);
  });

  it('throws CampaignNotReviewableError if under_review', () => {
    const campaign = makeUnderReviewCampaign();
    expect(() => campaign.returnToDraft()).toThrow(CampaignNotReviewableError);
  });
});

describe('Campaign.reconstitute() with reviewer fields', () => {
  it('defaults new reviewer fields to null when not provided', () => {
    const campaign = Campaign.reconstitute({
      id: 'c-001',
      creatorId: 'u-001',
      title: 'Test',
      summary: null,
      description: null,
      marsAlignmentStatement: null,
      category: 'propulsion',
      status: 'draft',
      minFundingTargetCents: 150_000_000,
      maxFundingCapCents: 500_000_000,
      deadline: null,
      budgetBreakdown: null,
      teamInfo: null,
      riskDisclosures: null,
      heroImageUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(campaign.reviewerId).toBeNull();
    expect(campaign.reviewerComment).toBeNull();
    expect(campaign.reviewedAt).toBeNull();
  });
});

// ─── Milestone.create() ───────────────────────────────────────────────────────

describe('Milestone.create()', () => {
  it('creates milestone with optional fields', () => {
    const m = Milestone.create({ campaignId: 'c-001' });
    expect(m.campaignId).toBe('c-001');
    expect(m.status).toBe('pending');
    expect(m.title).toBeNull();
    expect(m.fundingPercentage).toBeNull();
  });

  it('throws InvalidCampaignError for funding_percentage out of range', () => {
    expect(() =>
      Milestone.create({ campaignId: 'c-001', fundingPercentage: 101 }),
    ).toThrow(InvalidCampaignError);
    expect(() =>
      Milestone.create({ campaignId: 'c-001', fundingPercentage: -1 }),
    ).toThrow(InvalidCampaignError);
  });

  it('accepts 0 and 100 funding percentages', () => {
    expect(() => Milestone.create({ campaignId: 'c-001', fundingPercentage: 0 })).not.toThrow();
    expect(() => Milestone.create({ campaignId: 'c-001', fundingPercentage: 100 })).not.toThrow();
  });
});
