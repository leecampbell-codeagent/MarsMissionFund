import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { PublicCampaignCard } from './PublicCampaignCard';
import { type PublicCampaignListItem } from '../../../types/campaign';

const mockCampaign: PublicCampaignListItem = {
  id: '550e8400-e29b-41d4-a716-446655440001',
  title: 'Advanced Ion Drive Propulsion System',
  shortDescription: 'Next-generation ion drive for deep space missions.',
  category: 'propulsion',
  heroImageUrl: 'https://example.com/hero.jpg',
  status: 'live',
  fundingGoalCents: '310840000',
  totalRaisedCents: '130552800',
  contributorCount: 317,
  fundingPercentage: 42,
  deadline: '2026-06-15T00:00:00Z',
  daysRemaining: 102,
  launchedAt: '2026-01-15T00:00:00Z',
  creatorName: 'Dr. Sarah Chen',
};

function renderCard(campaign: PublicCampaignListItem = mockCampaign) {
  return render(
    <MemoryRouter>
      <PublicCampaignCard campaign={campaign} />
    </MemoryRouter>,
  );
}

describe('PublicCampaignCard', () => {
  it('renders campaign title', () => {
    renderCard();
    expect(screen.getByText('Advanced Ion Drive Propulsion System')).toBeInTheDocument();
  });

  it('renders short description', () => {
    renderCard();
    expect(screen.getByText('Next-generation ion drive for deep space missions.')).toBeInTheDocument();
  });

  it('renders category label', () => {
    renderCard();
    expect(screen.getByText('Propulsion')).toBeInTheDocument();
  });

  it('renders Live status badge', () => {
    renderCard();
    expect(screen.getByRole('status', { name: 'Campaign status: Live' })).toBeInTheDocument();
  });

  it('renders "Fully Funded" badge when status is funded', () => {
    const fundedCampaign: PublicCampaignListItem = {
      ...mockCampaign,
      status: 'funded',
      fundingPercentage: 100,
    };
    renderCard(fundedCampaign);
    expect(screen.getByRole('status', { name: 'Campaign status: Fully Funded' })).toBeInTheDocument();
    expect(screen.getByText('Fully Funded')).toBeInTheDocument();
  });

  it('renders "Ending Soon" badge when daysRemaining <= 7', () => {
    const endingSoon: PublicCampaignListItem = {
      ...mockCampaign,
      daysRemaining: 5,
    };
    renderCard(endingSoon);
    expect(screen.getByRole('status', { name: 'Campaign status: Ending Soon' })).toBeInTheDocument();
  });

  it('does NOT render "Ending Soon" when daysRemaining > 7', () => {
    renderCard();
    expect(screen.queryByText('Ending Soon')).not.toBeInTheDocument();
    expect(screen.getByText('Live')).toBeInTheDocument();
  });

  it('renders placeholder when heroImageUrl is null', () => {
    const noHero: PublicCampaignListItem = { ...mockCampaign, heroImageUrl: null };
    renderCard(noHero);
    // The img element should not be present
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('renders hero image when heroImageUrl is set', () => {
    renderCard();
    const img = screen.getByRole('img', { name: /hero image/i });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/hero.jpg');
  });

  it('renders title only (no short description) when shortDescription is null', () => {
    const noDesc: PublicCampaignListItem = { ...mockCampaign, shortDescription: null };
    renderCard(noDesc);
    expect(screen.getByText('Advanced Ion Drive Propulsion System')).toBeInTheDocument();
    expect(screen.queryByText('Next-generation ion drive for deep space missions.')).not.toBeInTheDocument();
  });

  it('does not show goal amount when fundingGoalCents is null', () => {
    const noGoal: PublicCampaignListItem = {
      ...mockCampaign,
      fundingGoalCents: null,
      fundingPercentage: null,
    };
    renderCard(noGoal);
    // Progress bar at 0%
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '0');
    // No goal amount text
    expect(screen.queryByText(/of \$/)).not.toBeInTheDocument();
  });

  it('shows creator name', () => {
    renderCard();
    expect(screen.getByText('by Dr. Sarah Chen')).toBeInTheDocument();
  });

  it('shows "by Creator" when creatorName is null', () => {
    const noCreator: PublicCampaignListItem = { ...mockCampaign, creatorName: null };
    renderCard(noCreator);
    expect(screen.getByText('by Creator')).toBeInTheDocument();
  });

  it('shows days remaining text', () => {
    renderCard();
    expect(screen.getByText('102 days left')).toBeInTheDocument();
  });

  it('shows "Last day!" when daysRemaining is 0', () => {
    const lastDay: PublicCampaignListItem = { ...mockCampaign, daysRemaining: 0 };
    renderCard(lastDay);
    expect(screen.getByText('Last day!')).toBeInTheDocument();
  });

  it('shows "No deadline" when daysRemaining is null', () => {
    const noDeadline: PublicCampaignListItem = {
      ...mockCampaign,
      daysRemaining: null,
      deadline: null,
    };
    renderCard(noDeadline);
    expect(screen.getByText('No deadline')).toBeInTheDocument();
  });

  it('handles long title (200 chars) without layout break', () => {
    const longTitle = 'A'.repeat(200);
    const longTitleCampaign: PublicCampaignListItem = { ...mockCampaign, title: longTitle };
    renderCard(longTitleCampaign);
    // Card should render without error and title should be present
    expect(screen.getByText(longTitle)).toBeInTheDocument();
  });

  it('renders a link to the campaign detail page', () => {
    renderCard();
    const link = screen.getByRole('link', { name: /view campaign/i });
    expect(link).toHaveAttribute('href', '/campaigns/550e8400-e29b-41d4-a716-446655440001');
  });

  it('caps progress bar at 100% width when fundingPercentage > 100', () => {
    const overfunded: PublicCampaignListItem = {
      ...mockCampaign,
      fundingPercentage: 127,
      totalRaisedCents: '394767400',
    };
    renderCard(overfunded);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '100');
  });

  it('renders progress bar at 0% when totalRaisedCents is 0', () => {
    const zeroCampaign: PublicCampaignListItem = {
      ...mockCampaign,
      totalRaisedCents: '0',
      fundingPercentage: 0,
    };
    renderCard(zeroCampaign);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '0');
    expect(screen.getByText('$0.00 raised')).toBeInTheDocument();
  });
});
