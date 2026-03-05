import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { CampaignResponse } from '../../api/campaign-api';
import { ReviewQueueCard } from './ReviewQueueCard';

function makeCampaign(overrides: Partial<CampaignResponse> = {}): CampaignResponse {
  return {
    id: 'camp-001',
    creator_id: 'creator-001',
    title: 'Ion Drive Project',
    summary: 'A revolutionary propulsion system.',
    description: null,
    mars_alignment_statement: null,
    category: 'propulsion',
    status: 'submitted',
    min_funding_target_cents: '150000000',
    max_funding_cap_cents: '500000000',
    deadline: null,
    budget_breakdown: null,
    team_info: null,
    risk_disclosures: null,
    hero_image_url: null,
    reviewer_id: null,
    reviewer_comment: null,
    reviewed_at: null,
    milestones: [],
    created_at: '2026-03-01T00:00:00Z',
    updated_at: '2026-03-01T00:00:00Z',
    ...overrides,
  };
}

describe('ReviewQueueCard', () => {
  it('renders campaign title', () => {
    render(<ReviewQueueCard campaign={makeCampaign()} />);
    expect(screen.getByText('Ion Drive Project')).toBeInTheDocument();
  });

  it('renders campaign summary', () => {
    render(<ReviewQueueCard campaign={makeCampaign()} />);
    expect(screen.getByText('A revolutionary propulsion system.')).toBeInTheDocument();
  });

  it('renders category label', () => {
    render(<ReviewQueueCard campaign={makeCampaign({ category: 'propulsion' })} />);
    expect(screen.getByText('PROPULSION')).toBeInTheDocument();
  });

  it('shows CLAIM CAMPAIGN button for submitted campaigns', () => {
    const onClaim = vi.fn();
    render(<ReviewQueueCard campaign={makeCampaign({ status: 'submitted' })} onClaim={onClaim} />);
    expect(screen.getByRole('button', { name: /claim campaign/i })).toBeInTheDocument();
  });

  it('does not show CLAIM button when no onClaim handler', () => {
    render(<ReviewQueueCard campaign={makeCampaign({ status: 'submitted' })} />);
    expect(screen.queryByRole('button', { name: /claim campaign/i })).not.toBeInTheDocument();
  });

  it('calls onClaim when Claim button is clicked', async () => {
    const user = userEvent.setup();
    const onClaim = vi.fn();
    render(<ReviewQueueCard campaign={makeCampaign({ status: 'submitted' })} onClaim={onClaim} />);
    await user.click(screen.getByRole('button', { name: /claim campaign/i }));
    expect(onClaim).toHaveBeenCalledTimes(1);
  });

  it('shows Approve/Reject/Recuse buttons when user is assigned reviewer', () => {
    const onApprove = vi.fn();
    const onReject = vi.fn();
    const onRecuse = vi.fn();
    render(
      <ReviewQueueCard
        campaign={makeCampaign({ status: 'under_review', reviewer_id: 'reviewer-001' })}
        currentUserId="reviewer-001"
        onApprove={onApprove}
        onReject={onReject}
        onRecuse={onRecuse}
      />,
    );
    expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reject/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /recuse/i })).toBeInTheDocument();
  });

  it('does not show Approve/Reject/Recuse buttons when not the assigned reviewer', () => {
    render(
      <ReviewQueueCard
        campaign={makeCampaign({ status: 'under_review', reviewer_id: 'reviewer-001' })}
        currentUserId="reviewer-002"
      />,
    );
    expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reject/i })).not.toBeInTheDocument();
  });

  it('calls onApprove when Approve button is clicked', async () => {
    const user = userEvent.setup();
    const onApprove = vi.fn();
    render(
      <ReviewQueueCard
        campaign={makeCampaign({ status: 'under_review', reviewer_id: 'reviewer-001' })}
        currentUserId="reviewer-001"
        onApprove={onApprove}
        onReject={vi.fn()}
        onRecuse={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: /approve/i }));
    expect(onApprove).toHaveBeenCalledTimes(1);
  });

  it('calls onReject when Reject button is clicked', async () => {
    const user = userEvent.setup();
    const onReject = vi.fn();
    render(
      <ReviewQueueCard
        campaign={makeCampaign({ status: 'under_review', reviewer_id: 'reviewer-001' })}
        currentUserId="reviewer-001"
        onApprove={vi.fn()}
        onReject={onReject}
        onRecuse={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: /reject/i }));
    expect(onReject).toHaveBeenCalledTimes(1);
  });

  it('disables Claim button when isClaimPending is true', () => {
    render(
      <ReviewQueueCard
        campaign={makeCampaign({ status: 'submitted' })}
        onClaim={vi.fn()}
        isClaimPending={true}
      />,
    );
    expect(screen.getByRole('button', { name: /claim/i })).toBeDisabled();
  });

  it('shows "Another reviewer" text when under_review but not assigned to current user', () => {
    render(
      <ReviewQueueCard
        campaign={makeCampaign({ status: 'under_review', reviewer_id: 'reviewer-001' })}
        currentUserId="reviewer-002"
      />,
    );
    expect(screen.getByText('Another reviewer')).toBeInTheDocument();
  });

  it('shows "You" as reviewer when under_review and assigned to current user', () => {
    render(
      <ReviewQueueCard
        campaign={makeCampaign({ status: 'under_review', reviewer_id: 'reviewer-001' })}
        currentUserId="reviewer-001"
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onRecuse={vi.fn()}
      />,
    );
    expect(screen.getByText('You')).toBeInTheDocument();
  });

  it('renders status badge', () => {
    render(<ReviewQueueCard campaign={makeCampaign({ status: 'submitted' })} />);
    // Status badge has aria-label "Status: SUBMITTED"
    expect(screen.getByLabelText(/status: submitted/i)).toBeInTheDocument();
  });

  it('renders under_review status badge', () => {
    render(
      <ReviewQueueCard
        campaign={makeCampaign({ status: 'under_review', reviewer_id: 'reviewer-001' })}
        currentUserId="reviewer-001"
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onRecuse={vi.fn()}
      />,
    );
    expect(screen.getByLabelText(/status: under review/i)).toBeInTheDocument();
  });
});
