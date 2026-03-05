import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import ProfileSettingsPage from './settings-profile';

const mockGetToken = vi.fn().mockResolvedValue('mock-token');
vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ getToken: mockGetToken, isLoaded: true }),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockAccount = {
  id: 'acc-abc123',
  email: 'operative@mars.fund',
  display_name: 'Mission Operative',
  bio: 'Passionate about interplanetary travel.',
  avatar_url: 'https://example.com/avatar.jpg',
  status: 'active',
  roles: ['backer'],
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
};

function renderWithProviders() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ProfileSettingsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ProfileSettingsPage', () => {
  it('renders loading skeleton initially', () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    renderWithProviders();
    // Page is rendered with skeleton content when loading
    expect(document.querySelector('.settings-page')).toBeInTheDocument();
  });

  it('renders heading and section label when data is loaded', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockAccount,
    });

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('YOUR PROFILE');
    });
    expect(screen.getByText('01 — PROFILE')).toBeInTheDocument();
  });

  it('pre-populates form fields with account data', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockAccount,
    });

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByLabelText(/display name/i)).toHaveValue('Mission Operative');
    });
    expect(screen.getByLabelText(/bio/i)).toHaveValue('Passionate about interplanetary travel.');
    expect(screen.getByLabelText(/avatar url/i)).toHaveValue('https://example.com/avatar.jpg');
  });

  it('shows email as read-only', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockAccount,
    });

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText('operative@mars.fund')).toBeInTheDocument();
    });
  });

  it('disables Save Changes button when no changes have been made', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockAccount,
    });

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save Changes' })).toBeDisabled();
    });
  });

  it('enables Save Changes button when a change is made', async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockAccount,
    });

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByLabelText(/display name/i)).toBeInTheDocument();
    });

    await user.clear(screen.getByLabelText(/display name/i));
    await user.type(screen.getByLabelText(/display name/i), 'New Name');

    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeEnabled();
  });

  it('shows success message after saving', async () => {
    const user = userEvent.setup();
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockAccount,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...mockAccount, display_name: 'New Name' }),
      });

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByLabelText(/display name/i)).toBeInTheDocument();
    });

    await user.clear(screen.getByLabelText(/display name/i));
    await user.type(screen.getByLabelText(/display name/i), 'New Name');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Profile updated successfully.');
    });
  });

  it('shows error message when save fails', async () => {
    const user = userEvent.setup();
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockAccount,
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: { code: 'SERVER_ERROR', message: 'Server error' } }),
      });

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByLabelText(/display name/i)).toBeInTheDocument();
    });

    await user.clear(screen.getByLabelText(/display name/i));
    await user.type(screen.getByLabelText(/display name/i), 'Changed');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        "We couldn't save your changes. Try again.",
      );
    });
  });
});
