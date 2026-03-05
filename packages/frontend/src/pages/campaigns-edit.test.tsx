import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import EditCampaignPage from './campaigns-edit';

const mockGetToken = vi.fn().mockResolvedValue('mock-token');
vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ getToken: mockGetToken, isLoaded: true }),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

function makeCampaign(overrides: Record<string, unknown> = {}) {
  return {
    data: {
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
    },
  };
}

function renderWithProviders(campaignId = 'camp-001') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/campaigns/${campaignId}/edit`]}>
        <Routes>
          <Route path="/campaigns/:id/edit" element={<EditCampaignPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('EditCampaignPage', () => {
  it('renders loading skeleton initially', () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    renderWithProviders();
    expect(document.querySelector('.edit-campaign-page')).toBeInTheDocument();
  });

  it('renders campaign title in heading when loaded', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => makeCampaign(),
    });
    renderWithProviders();
    await waitFor(() => {
      expect(screen.getByText('ION DRIVE PROJECT')).toBeInTheDocument();
    });
  });

  it('renders EDIT CAMPAIGN label for draft status', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => makeCampaign({ status: 'draft' }),
    });
    renderWithProviders();
    await waitFor(() => {
      expect(screen.getByText('EDIT CAMPAIGN')).toBeInTheDocument();
    });
  });

  it('renders VIEW CAMPAIGN label for submitted status', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => makeCampaign({ status: 'submitted' }),
    });
    renderWithProviders();
    await waitFor(() => {
      expect(screen.getByText('VIEW CAMPAIGN')).toBeInTheDocument();
    });
  });

  it('renders form fields when campaign is loaded', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => makeCampaign(),
    });
    renderWithProviders();
    await waitFor(() => {
      expect(screen.getByLabelText(/campaign title/i)).toBeInTheDocument();
    });
  });

  it('renders SAVE DRAFT and SUBMIT FOR REVIEW buttons for draft campaigns', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => makeCampaign({ status: 'draft' }),
    });
    renderWithProviders();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save draft/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /submit for review/i })).toBeInTheDocument();
    });
  });

  it('renders readonly notice for submitted campaigns', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => makeCampaign({ status: 'submitted' }),
    });
    renderWithProviders();
    await waitFor(() => {
      expect(screen.getByRole('note')).toBeInTheDocument();
      expect(screen.getByText(/no longer be edited/i)).toBeInTheDocument();
    });
  });

  it('shows not found message on 404 error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: { code: 'CAMPAIGN_NOT_FOUND', message: 'Campaign not found.' } }),
    });
    renderWithProviders();
    await waitFor(() => {
      expect(screen.getByText('CAMPAIGN NOT FOUND')).toBeInTheDocument();
    });
  });
});
