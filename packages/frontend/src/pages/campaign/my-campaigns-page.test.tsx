import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MyCampaignsPage from './my-campaigns-page';
import { type CampaignSummary } from '../../types/campaign';

// Mock the hooks
vi.mock('../../hooks/campaign/use-my-campaigns', () => ({
  useMyCampaigns: vi.fn(),
}));

import { useMyCampaigns } from '../../hooks/campaign/use-my-campaigns';

const mockCampaigns: CampaignSummary[] = [
  {
    id: '550e8400-e29b-41d4-a716-446655440001',
    creatorUserId: '550e8400-e29b-41d4-a716-446655440002',
    title: 'Ion Drive Propulsion',
    status: 'draft',
    category: 'propulsion_systems',
    fundingGoalCents: '150000000',
    submittedAt: null,
    createdAt: '2026-01-15T10:30:00Z',
    updatedAt: '2026-01-16T12:00:00Z',
  },
];

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('MyCampaignsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state', () => {
    vi.mocked(useMyCampaigns).mockReturnValue({
      campaigns: [],
      isLoading: true,
      isError: false,
      error: null,
    });

    renderWithProviders(<MyCampaignsPage />);
    expect(screen.getByRole('status', { name: 'Loading campaigns' })).toBeInTheDocument();
  });

  it('renders error state', () => {
    vi.mocked(useMyCampaigns).mockReturnValue({
      campaigns: [],
      isLoading: false,
      isError: true,
      error: { status: 500, code: 'SERVER_ERROR', message: 'Failed to load campaigns.' } as import('../../api/client').ApiError,
    });

    renderWithProviders(<MyCampaignsPage />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('renders empty state with Create Campaign CTA', () => {
    vi.mocked(useMyCampaigns).mockReturnValue({
      campaigns: [],
      isLoading: false,
      isError: false,
      error: null,
    });

    renderWithProviders(<MyCampaignsPage />);
    expect(screen.getByText("You haven't created any campaigns yet. Start your Mars mission proposal.")).toBeInTheDocument();
    // The Create Campaign button (in both header and empty state)
    const buttons = screen.getAllByRole('button', { name: /Create Campaign/i });
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });

  it('renders list of campaigns', () => {
    vi.mocked(useMyCampaigns).mockReturnValue({
      campaigns: mockCampaigns,
      isLoading: false,
      isError: false,
      error: null,
    });

    renderWithProviders(<MyCampaignsPage />);
    expect(screen.getByText('Ion Drive Propulsion')).toBeInTheDocument();
  });

  it('shows page heading', () => {
    vi.mocked(useMyCampaigns).mockReturnValue({
      campaigns: [],
      isLoading: false,
      isError: false,
      error: null,
    });

    renderWithProviders(<MyCampaignsPage />);
    expect(screen.getByRole('heading', { name: 'My Campaigns' })).toBeInTheDocument();
  });
});
