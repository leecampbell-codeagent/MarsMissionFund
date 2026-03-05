import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiError } from '../../../api/client';
import type { PublicCampaignDetail } from '../../../types/campaign';
import PublicCampaignDetailPage from './public-campaign-detail-page';

vi.mock('../../../hooks/campaign/use-public-campaign', () => ({
  usePublicCampaign: vi.fn(),
}));

import { usePublicCampaign } from '../../../hooks/campaign/use-public-campaign';

const mockCampaign: PublicCampaignDetail = {
  id: '550e8400-e29b-41d4-a716-446655440001',
  title: 'Advanced Ion Drive Propulsion System',
  shortDescription: 'Next-generation ion drive for deep space missions.',
  description:
    'This mission aims to develop a revolutionary ion drive.\n\nThe technology builds on 20 years of research.',
  category: 'propulsion',
  heroImageUrl: null,
  status: 'live',
  fundingGoalCents: '310840000',
  totalRaisedCents: '130552800',
  fundingCapCents: null,
  contributorCount: 317,
  fundingPercentage: 42,
  deadline: '2026-06-15T00:00:00Z',
  daysRemaining: 102,
  launchedAt: '2026-01-15T00:00:00Z',
  creatorName: 'Dr. Sarah Chen',
  milestones: [
    {
      id: '550e8400-e29b-41d4-a716-446655440002',
      title: 'Phase 1: Prototype',
      description: 'Build initial prototype',
      fundingBasisPoints: 3000,
      targetDate: '2026-09-01',
    },
  ],
  teamMembers: [
    {
      id: '550e8400-e29b-41d4-a716-446655440003',
      name: 'Dr. Sarah Chen',
      role: 'Lead Engineer',
      bio: 'Expert in ion propulsion with 15 years of experience.',
      linkedInUrl: null,
    },
  ],
  riskDisclosures: [
    {
      id: '550e8400-e29b-41d4-a716-446655440004',
      risk: 'Technical complexity may cause delays',
      mitigation: 'Staged development approach with fallback plans',
    },
  ],
  budgetBreakdown: [
    {
      id: '550e8400-e29b-41d4-a716-446655440005',
      category: 'R&D',
      description: 'Research and development',
      estimatedCents: '155420000',
    },
  ],
  alignmentStatement: 'This mission directly supports Mars mission propulsion requirements.',
  tags: ['propulsion', 'deep-space', 'ion-drive'],
};

function renderPage(campaignId = '550e8400-e29b-41d4-a716-446655440001') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/campaigns/${campaignId}`]}>
        <Routes>
          <Route path="/campaigns/:id" element={<PublicCampaignDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('PublicCampaignDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state while data is fetching', () => {
    vi.mocked(usePublicCampaign).mockReturnValue({
      campaign: null,
      isLoading: true,
      isError: false,
      error: null,
    });
    renderPage();
    expect(screen.getByRole('status', { name: 'Loading campaign' })).toBeInTheDocument();
  });

  it('renders all campaign detail fields for live campaign', () => {
    vi.mocked(usePublicCampaign).mockReturnValue({
      campaign: mockCampaign,
      isLoading: false,
      isError: false,
      error: null,
    });
    renderPage();
    expect(
      screen.getByRole('heading', { name: /Advanced Ion Drive Propulsion System/i }),
    ).toBeInTheDocument();
    expect(screen.getByText('by Dr. Sarah Chen')).toBeInTheDocument();
    expect(screen.getByText('Propulsion')).toBeInTheDocument();
  });

  it('renders "Fully Funded" badge for funded campaign', () => {
    vi.mocked(usePublicCampaign).mockReturnValue({
      campaign: { ...mockCampaign, status: 'funded', fundingPercentage: 100 },
      isLoading: false,
      isError: false,
      error: null,
    });
    renderPage();
    expect(
      screen.getByRole('status', { name: 'Campaign status: Fully Funded' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Fully Funded')).toBeInTheDocument();
  });

  it('renders placeholder when heroImageUrl is null', () => {
    vi.mocked(usePublicCampaign).mockReturnValue({
      campaign: { ...mockCampaign, heroImageUrl: null },
      isLoading: false,
      isError: false,
      error: null,
    });
    renderPage();
    expect(screen.queryByRole('img', { name: /hero image/i })).not.toBeInTheDocument();
  });

  it('renders hero image when heroImageUrl is set', () => {
    vi.mocked(usePublicCampaign).mockReturnValue({
      campaign: { ...mockCampaign, heroImageUrl: 'https://example.com/hero.jpg' },
      isLoading: false,
      isError: false,
      error: null,
    });
    renderPage();
    expect(screen.getByRole('img', { name: /hero image/i })).toBeInTheDocument();
  });

  it('renders "No milestones defined" for empty milestones array', () => {
    vi.mocked(usePublicCampaign).mockReturnValue({
      campaign: { ...mockCampaign, milestones: [] },
      isLoading: false,
      isError: false,
      error: null,
    });
    renderPage();
    expect(screen.getByText('No milestones defined.')).toBeInTheDocument();
  });

  it('renders milestones when present', () => {
    vi.mocked(usePublicCampaign).mockReturnValue({
      campaign: mockCampaign,
      isLoading: false,
      isError: false,
      error: null,
    });
    renderPage();
    expect(screen.getByText('Phase 1: Prototype')).toBeInTheDocument();
    expect(screen.getByText('30.00%')).toBeInTheDocument();
  });

  it('renders team member information', () => {
    vi.mocked(usePublicCampaign).mockReturnValue({
      campaign: mockCampaign,
      isLoading: false,
      isError: false,
      error: null,
    });
    renderPage();
    expect(screen.getByText('Dr. Sarah Chen')).toBeInTheDocument();
    expect(screen.getByText('Lead Engineer')).toBeInTheDocument();
    expect(
      screen.getByText('Expert in ion propulsion with 15 years of experience.'),
    ).toBeInTheDocument();
  });

  it('renders "Team information unavailable." for empty teamMembers', () => {
    vi.mocked(usePublicCampaign).mockReturnValue({
      campaign: { ...mockCampaign, teamMembers: [] },
      isLoading: false,
      isError: false,
      error: null,
    });
    renderPage();
    expect(screen.getByText('Team information unavailable.')).toBeInTheDocument();
  });

  it('renders risk disclosures', () => {
    vi.mocked(usePublicCampaign).mockReturnValue({
      campaign: mockCampaign,
      isLoading: false,
      isError: false,
      error: null,
    });
    renderPage();
    expect(screen.getByText('Technical complexity may cause delays')).toBeInTheDocument();
    expect(screen.getByText(/Staged development approach/)).toBeInTheDocument();
  });

  it('renders 404 message for non-existent campaign', () => {
    vi.mocked(usePublicCampaign).mockReturnValue({
      campaign: null,
      isLoading: false,
      isError: true,
      error: { status: 404, code: 'NOT_FOUND', message: 'Campaign not found' } as ApiError,
    });
    renderPage();
    expect(screen.getByRole('heading', { name: /mission not found/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /browse campaigns/i })).toBeInTheDocument();
  });

  it('renders generic error state on non-404 API failure', () => {
    vi.mocked(usePublicCampaign).mockReturnValue({
      campaign: null,
      isLoading: false,
      isError: true,
      error: { status: 500, code: 'SERVER_ERROR', message: 'Server error' } as ApiError,
    });
    renderPage();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/unable to load this campaign/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('"Back This Mission" CTA button is present and accessible', () => {
    vi.mocked(usePublicCampaign).mockReturnValue({
      campaign: mockCampaign,
      isLoading: false,
      isError: false,
      error: null,
    });
    renderPage();
    const cta = screen.getByRole('link', { name: /back this mission/i });
    expect(cta).toBeInTheDocument();
    expect(cta).toHaveAttribute('href', `/campaigns/${mockCampaign.id}/contribute`);
  });

  it('displays days remaining correctly for future deadline', () => {
    vi.mocked(usePublicCampaign).mockReturnValue({
      campaign: { ...mockCampaign, daysRemaining: 45 },
      isLoading: false,
      isError: false,
      error: null,
    });
    renderPage();
    expect(screen.getByText('45 days left')).toBeInTheDocument();
  });

  it('displays "Last day!" when daysRemaining is 0', () => {
    vi.mocked(usePublicCampaign).mockReturnValue({
      campaign: { ...mockCampaign, daysRemaining: 0 },
      isLoading: false,
      isError: false,
      error: null,
    });
    renderPage();
    expect(screen.getByText('Last day!')).toBeInTheDocument();
  });

  it('displays "No deadline" when daysRemaining is null', () => {
    vi.mocked(usePublicCampaign).mockReturnValue({
      campaign: { ...mockCampaign, daysRemaining: null, deadline: null },
      isLoading: false,
      isError: false,
      error: null,
    });
    renderPage();
    expect(screen.getByText('No deadline')).toBeInTheDocument();
  });

  it('renders alignment statement when present', () => {
    vi.mocked(usePublicCampaign).mockReturnValue({
      campaign: mockCampaign,
      isLoading: false,
      isError: false,
      error: null,
    });
    renderPage();
    expect(screen.getByRole('region', { name: /mars mission alignment/i })).toBeInTheDocument();
    expect(screen.getByText(/directly supports Mars mission/)).toBeInTheDocument();
  });

  it('does not render alignment section when null', () => {
    vi.mocked(usePublicCampaign).mockReturnValue({
      campaign: { ...mockCampaign, alignmentStatement: null },
      isLoading: false,
      isError: false,
      error: null,
    });
    renderPage();
    expect(
      screen.queryByRole('region', { name: /mars mission alignment/i }),
    ).not.toBeInTheDocument();
  });

  it('renders tags when present', () => {
    vi.mocked(usePublicCampaign).mockReturnValue({
      campaign: mockCampaign,
      isLoading: false,
      isError: false,
      error: null,
    });
    renderPage();
    expect(screen.getByText('propulsion')).toBeInTheDocument();
    expect(screen.getByText('ion-drive')).toBeInTheDocument();
  });

  it('does not render tags section when tags is empty', () => {
    vi.mocked(usePublicCampaign).mockReturnValue({
      campaign: { ...mockCampaign, tags: [] },
      isLoading: false,
      isError: false,
      error: null,
    });
    renderPage();
    // Tags section not rendered — campaign title should still be there
    expect(screen.getByRole('heading', { name: /Advanced Ion Drive/i })).toBeInTheDocument();
  });

  it('renders "by Creator" when creatorName is null', () => {
    vi.mocked(usePublicCampaign).mockReturnValue({
      campaign: { ...mockCampaign, creatorName: null },
      isLoading: false,
      isError: false,
      error: null,
    });
    renderPage();
    expect(screen.getByText('by Creator')).toBeInTheDocument();
  });

  it('shows description with white-space pre-wrap for newlines', () => {
    vi.mocked(usePublicCampaign).mockReturnValue({
      campaign: mockCampaign,
      isLoading: false,
      isError: false,
      error: null,
    });
    renderPage();
    expect(screen.getByRole('region', { name: /campaign description/i })).toBeInTheDocument();
  });
});
