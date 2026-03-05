import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import ReviewQueuePage from './admin-review-queue';

const mockGetToken = vi.fn().mockResolvedValue('mock-token');
vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ getToken: mockGetToken, isLoaded: true }),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

function makeCampaign(overrides: Record<string, unknown> = {}) {
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

function makeAccountResponse(overrides: Record<string, unknown> = {}) {
  return {
    id: 'reviewer-001',
    email: 'reviewer@test.com',
    display_name: 'Test Reviewer',
    bio: null,
    avatar_url: null,
    status: 'active',
    roles: ['backer', 'reviewer'],
    onboarding_completed: true,
    onboarding_step: 'completed',
    notification_preferences: {
      campaign_updates: true,
      milestone_completions: true,
      contribution_confirmations: true,
      new_campaign_recommendations: true,
      security_alerts: true,
      platform_announcements: false,
    },
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
        <ReviewQueuePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function mockReviewQueueAndAccount(campaigns: unknown[]) {
  mockFetch.mockImplementation((url: string) => {
    if (url.includes('/api/v1/campaigns/review-queue')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: campaigns }),
      });
    }
    if (url.includes('/api/v1/accounts/me')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(makeAccountResponse()),
      });
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({}),
    });
  });
}

describe('ReviewQueuePage', () => {
  it('shows loading skeleton initially', () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    renderWithProviders();
    // Skeleton is rendered during loading
    const skeletons = document.querySelectorAll('.rq-skeleton');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders heading when loaded', async () => {
    mockReviewQueueAndAccount([]);
    renderWithProviders();
    await waitFor(() => {
      expect(screen.getByText('MISSION REVIEW BOARD')).toBeInTheDocument();
    });
  });

  it('renders section label', async () => {
    mockReviewQueueAndAccount([]);
    renderWithProviders();
    await waitFor(() => {
      expect(screen.getByText('REVIEW QUEUE')).toBeInTheDocument();
    });
  });

  it('shows empty state when no campaigns in queue', async () => {
    mockReviewQueueAndAccount([]);
    renderWithProviders();
    await waitFor(() => {
      expect(screen.getByText('QUEUE IS CLEAR')).toBeInTheDocument();
      expect(screen.getByText('All submitted campaigns have been reviewed.')).toBeInTheDocument();
    });
  });

  it('renders campaign cards when campaigns exist', async () => {
    mockReviewQueueAndAccount([
      makeCampaign({ id: 'camp-001', title: 'Ion Drive Project', status: 'submitted' }),
      makeCampaign({ id: 'camp-002', title: 'Habitat Construction System', status: 'submitted' }),
    ]);
    renderWithProviders();
    await waitFor(() => {
      expect(screen.getByText('Ion Drive Project')).toBeInTheDocument();
      expect(screen.getByText('Habitat Construction System')).toBeInTheDocument();
    });
  });

  it('shows error state on API failure', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/v1/campaigns/review-queue')) {
        return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(makeAccountResponse()),
      });
    });
    renderWithProviders();
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(
        screen.getByText('Failed to load review queue. Please try again.'),
      ).toBeInTheDocument();
    });
  });

  it('renders CLAIM CAMPAIGN button for submitted campaigns', async () => {
    mockReviewQueueAndAccount([makeCampaign({ status: 'submitted' })]);
    renderWithProviders();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /claim campaign/i })).toBeInTheDocument();
    });
  });

  it('renders Approve/Reject buttons for campaigns assigned to current user', async () => {
    mockReviewQueueAndAccount([
      makeCampaign({
        status: 'under_review',
        reviewer_id: 'reviewer-001',
      }),
    ]);
    renderWithProviders();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /reject/i })).toBeInTheDocument();
    });
  });
});
