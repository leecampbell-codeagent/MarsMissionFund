import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import MyCampaignsPage from './campaigns-mine';

const mockGetToken = vi.fn().mockResolvedValue('mock-token');
vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ getToken: mockGetToken, isLoaded: true }),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

function makeCampaignsResponse(campaigns: unknown[]) {
  return { data: campaigns };
}

function makeCampaign(overrides: Record<string, unknown> = {}) {
  return {
    id: 'camp-001',
    creator_id: 'user-001',
    title: 'Ion Drive Project',
    summary: 'A revolutionary propulsion system.',
    description: null,
    mars_alignment_statement: null,
    category: 'propulsion',
    status: 'draft',
    min_funding_target_cents: '150000000',
    max_funding_cap_cents: '500000000',
    deadline: null,
    budget_breakdown: null,
    team_info: null,
    risk_disclosures: null,
    hero_image_url: null,
    milestones: [],
    created_at: '2026-03-01T00:00:00Z',
    updated_at: '2026-03-01T00:00:00Z',
    ...overrides,
  };
}

function renderWithProviders() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <MyCampaignsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('MyCampaignsPage', () => {
  it('renders loading skeleton initially', () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    renderWithProviders();
    // Loading state: skeleton is present, no heading yet
    expect(document.querySelector('.campaigns-page')).toBeInTheDocument();
  });

  it('renders MISSION CONTROL heading when loaded', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => makeCampaignsResponse([]),
    });
    renderWithProviders();
    await waitFor(() => {
      expect(screen.getByText('MISSION CONTROL')).toBeInTheDocument();
    });
  });

  it('renders empty state when no campaigns', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => makeCampaignsResponse([]),
    });
    renderWithProviders();
    await waitFor(() => {
      expect(screen.getByText('NO MISSIONS YET')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /start a campaign/i })).toBeInTheDocument();
    });
  });

  it('renders campaign cards when campaigns exist', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => makeCampaignsResponse([makeCampaign()]),
    });
    renderWithProviders();
    await waitFor(() => {
      expect(screen.getByText('Ion Drive Project')).toBeInTheDocument();
    });
  });

  it('renders new campaign link', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => makeCampaignsResponse([]),
    });
    renderWithProviders();
    await waitFor(() => {
      const link = screen.getByRole('link', { name: /new campaign/i });
      expect(link).toHaveAttribute('href', '/campaigns/new');
    });
  });

  it('shows error state on API failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: { code: 'SERVER_ERROR', message: 'Server error' } }),
    });
    renderWithProviders();
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/failed to load campaigns/i)).toBeInTheDocument();
    });
  });
});
