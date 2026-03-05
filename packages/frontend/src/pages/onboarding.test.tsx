import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import OnboardingPage from './onboarding';

// Mock @clerk/clerk-react
const mockGetToken = vi.fn().mockResolvedValue('mock-token');
vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ getToken: mockGetToken, isLoaded: true }),
}));

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

const welcomeAccount = {
  id: 'acc-123',
  email: 'test@example.com',
  display_name: null,
  bio: null,
  avatar_url: null,
  status: 'active',
  roles: ['backer'],
  onboarding_completed: false,
  onboarding_step: 'welcome',
  notification_preferences: {
    campaign_updates: true,
    milestone_completions: true,
    contribution_confirmations: true,
    new_campaign_recommendations: true,
    security_alerts: true,
    platform_announcements: false,
  },
};

function renderWithProviders() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <OnboardingPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('OnboardingPage', () => {
  it('shows loading state initially', () => {
    mockFetch.mockReturnValue(new Promise(() => {})); // never resolves
    renderWithProviders();
    expect(screen.getByRole('status', { name: /checking authentication/i })).toBeInTheDocument();
  });

  it('renders welcome step when account onboarding_step is "welcome"', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => welcomeAccount,
    });

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
        'WELCOME TO THE MISSION',
      );
    });
  });

  it('renders error state when account fetch fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: { code: 'SERVER_ERROR', message: 'Server error' } }),
    });

    renderWithProviders();

    await waitFor(
      () => {
        expect(screen.getByText(/We couldn't load your account/i)).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it('redirects to /dashboard when onboarding is already completed', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ...welcomeAccount,
        onboarding_completed: true,
        onboarding_step: 'completed',
      }),
    });

    renderWithProviders();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
    });
  });

  it('renders role_selection step directly when account is at that step', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ...welcomeAccount, onboarding_step: 'role_selection' }),
    });

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('CHOOSE YOUR ROLE');
    });
  });

  it('advances to role_selection step when Begin Setup is clicked', async () => {
    const user = userEvent.setup();
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => welcomeAccount,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...welcomeAccount, onboarding_step: 'role_selection' }),
      });

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Begin Setup' })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Begin Setup' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('CHOOSE YOUR ROLE');
    });
  });

  it('shows completion step when onboarding step is completed', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ...welcomeAccount,
        onboarding_step: 'completed',
        onboarding_completed: false, // edge case: step=completed but flag not set yet
      }),
    });

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
        "YOU'RE READY FOR MARS",
      );
    });
  });
});
