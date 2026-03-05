import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PaginatedCampaigns, PublicCampaignListItem } from '../../../types/campaign';
import CampaignDiscoveryPage from './campaign-discovery-page';

// Mock the hooks
vi.mock('../../../hooks/campaign/use-public-campaigns', () => ({
  usePublicCampaigns: vi.fn(),
}));

// Mock CategoryStatsBar to avoid nested query complexity in tests
vi.mock('../../../components/campaign/category-stats-bar/CategoryStatsBar', () => ({
  CategoryStatsBar: () => null,
}));

import { usePublicCampaigns } from '../../../hooks/campaign/use-public-campaigns';

const mockCampaign: PublicCampaignListItem = {
  id: '550e8400-e29b-41d4-a716-446655440001',
  title: 'Advanced Ion Drive System',
  shortDescription: 'Next-generation ion drive for deep space missions.',
  category: 'propulsion',
  heroImageUrl: null,
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

const mockPaginatedData: PaginatedCampaigns = {
  data: [mockCampaign],
  pagination: { total: 1, limit: 20, offset: 0 },
};

function renderPage(initialUrl = '/campaigns') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialUrl]}>
        <CampaignDiscoveryPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('CampaignDiscoveryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders page heading', () => {
    vi.mocked(usePublicCampaigns).mockReturnValue({
      data: mockPaginatedData,
      isLoading: false,
      isError: false,
      error: null,
    });
    renderPage();
    expect(screen.getByRole('heading', { name: /find your mission/i })).toBeInTheDocument();
  });

  it('renders loading skeleton while data is fetching', () => {
    vi.mocked(usePublicCampaigns).mockReturnValue({
      data: null,
      isLoading: true,
      isError: false,
      error: null,
    });
    renderPage();
    expect(screen.getByRole('status', { name: 'Loading campaigns' })).toBeInTheDocument();
  });

  it('renders campaign cards when data loads', () => {
    vi.mocked(usePublicCampaigns).mockReturnValue({
      data: mockPaginatedData,
      isLoading: false,
      isError: false,
      error: null,
    });
    renderPage();
    expect(screen.getByText('Advanced Ion Drive System')).toBeInTheDocument();
  });

  it('renders empty state when no campaigns found', () => {
    vi.mocked(usePublicCampaigns).mockReturnValue({
      data: { data: [], pagination: { total: 0, limit: 20, offset: 0 } },
      isLoading: false,
      isError: false,
      error: null,
    });
    renderPage();
    expect(screen.getByText(/no campaigns found matching your search/i)).toBeInTheDocument();
  });

  it('renders error state on API failure', () => {
    vi.mocked(usePublicCampaigns).mockReturnValue({
      data: null,
      isLoading: false,
      isError: true,
      error: {
        status: 500,
        code: 'SERVER_ERROR',
        message: 'Failed',
      } as import('../../../api/client').ApiError,
    });
    renderPage();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/unable to load campaigns/i)).toBeInTheDocument();
  });

  it('shows total campaign count', () => {
    vi.mocked(usePublicCampaigns).mockReturnValue({
      data: mockPaginatedData,
      isLoading: false,
      isError: false,
      error: null,
    });
    renderPage();
    expect(screen.getByText('1 campaign found')).toBeInTheDocument();
  });

  it('renders search input', () => {
    vi.mocked(usePublicCampaigns).mockReturnValue({
      data: mockPaginatedData,
      isLoading: false,
      isError: false,
      error: null,
    });
    renderPage();
    expect(screen.getByRole('searchbox', { name: 'Search campaigns' })).toBeInTheDocument();
  });

  it('renders category filter', () => {
    vi.mocked(usePublicCampaigns).mockReturnValue({
      data: mockPaginatedData,
      isLoading: false,
      isError: false,
      error: null,
    });
    renderPage();
    // CategoryFilter renders category buttons
    expect(screen.getByRole('button', { name: /Filter by Propulsion/i })).toBeInTheDocument();
  });

  it('renders sort select', () => {
    vi.mocked(usePublicCampaigns).mockReturnValue({
      data: mockPaginatedData,
      isLoading: false,
      isError: false,
      error: null,
    });
    renderPage();
    expect(screen.getByRole('combobox', { name: 'Sort campaigns' })).toBeInTheDocument();
  });

  it('shows Load More button when more pages are available', () => {
    vi.mocked(usePublicCampaigns).mockReturnValue({
      data: {
        data: [mockCampaign],
        pagination: { total: 40, limit: 20, offset: 0 },
      },
      isLoading: false,
      isError: false,
      error: null,
    });
    renderPage();
    expect(screen.getByRole('button', { name: /load more/i })).toBeInTheDocument();
  });

  it('does not show Load More when all results fit on one page', () => {
    vi.mocked(usePublicCampaigns).mockReturnValue({
      data: mockPaginatedData,
      isLoading: false,
      isError: false,
      error: null,
    });
    renderPage();
    expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument();
  });

  it('selecting a category updates the filter', async () => {
    vi.mocked(usePublicCampaigns).mockReturnValue({
      data: mockPaginatedData,
      isLoading: false,
      isError: false,
      error: null,
    });
    renderPage();
    const propulsionBtn = screen.getByRole('button', { name: /Filter by Propulsion/i });
    await userEvent.click(propulsionBtn);
    // After clicking, the button should be pressed
    await waitFor(() => {
      expect(propulsionBtn).toHaveAttribute('aria-pressed', 'true');
    });
  });

  it('changing sort updates the select value', async () => {
    vi.mocked(usePublicCampaigns).mockReturnValue({
      data: mockPaginatedData,
      isLoading: false,
      isError: false,
      error: null,
    });
    renderPage();
    const sortSelect = screen.getByRole('combobox', { name: 'Sort campaigns' });
    await userEvent.selectOptions(sortSelect, 'most_funded');
    expect(sortSelect).toHaveValue('most_funded');
  });
});
