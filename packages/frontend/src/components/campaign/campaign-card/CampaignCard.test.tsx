import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { CampaignCard } from './CampaignCard';
import { type CampaignSummary } from '../../../types/campaign';

const mockCampaign: CampaignSummary = {
  id: '550e8400-e29b-41d4-a716-446655440001',
  creatorUserId: '550e8400-e29b-41d4-a716-446655440002',
  title: 'Ion Drive Propulsion System',
  status: 'draft',
  category: 'propulsion',
  fundingGoalCents: '150000000', // $1,500,000.00
  submittedAt: null,
  createdAt: '2026-01-15T10:30:00Z',
  updatedAt: '2026-01-16T12:00:00Z',
};

describe('CampaignCard', () => {
  it('renders campaign title', () => {
    render(<CampaignCard campaign={mockCampaign} />);
    expect(screen.getByText('Ion Drive Propulsion System')).toBeInTheDocument();
  });

  it('renders campaign status badge', () => {
    render(<CampaignCard campaign={mockCampaign} />);
    expect(screen.getByRole('status', { name: 'Campaign status: Draft' })).toBeInTheDocument();
  });

  it('renders category label in human-readable form', () => {
    render(<CampaignCard campaign={mockCampaign} />);
    expect(screen.getByText('Propulsion')).toBeInTheDocument();
  });

  it('renders funding goal formatted as USD', () => {
    render(<CampaignCard campaign={mockCampaign} />);
    // $1,500,000.00 — exact format may vary slightly by locale
    expect(screen.getByText(/\$1,500,000/)).toBeInTheDocument();
  });

  it('renders created date when no submittedAt', () => {
    render(<CampaignCard campaign={mockCampaign} />);
    expect(screen.getByText(/Created/)).toBeInTheDocument();
  });

  it('renders submitted date when submittedAt is set', () => {
    const submittedCampaign: CampaignSummary = {
      ...mockCampaign,
      status: 'submitted',
      submittedAt: '2026-02-01T09:00:00Z',
    };
    render(<CampaignCard campaign={submittedCampaign} />);
    // The date label text "Submitted Feb 1, 2026" (not the badge)
    expect(screen.getByText(/Submitted Feb/)).toBeInTheDocument();
  });

  it('calls onClick when clicked', async () => {
    const handleClick = vi.fn();
    render(<CampaignCard campaign={mockCampaign} onClick={handleClick} />);
    await userEvent.click(screen.getByRole('button', { name: /Campaign: Ion Drive Propulsion System/ }));
    expect(handleClick).toHaveBeenCalledOnce();
  });

  it('does not render as interactive when no onClick', () => {
    render(<CampaignCard campaign={mockCampaign} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows "No category" when category is null', () => {
    const noCategoryCampaign: CampaignSummary = {
      ...mockCampaign,
      category: null,
    };
    render(<CampaignCard campaign={noCategoryCampaign} />);
    expect(screen.getByText('No category')).toBeInTheDocument();
  });

  it('does not render funding goal when null', () => {
    const noGoalCampaign: CampaignSummary = {
      ...mockCampaign,
      fundingGoalCents: null,
    };
    render(<CampaignCard campaign={noGoalCampaign} />);
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
  });
});
