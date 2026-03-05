import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import PreferencesSettingsPage from './settings-preferences';

const mockGetToken = vi.fn().mockResolvedValue('mock-token');
vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ getToken: mockGetToken, isLoaded: true }),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockAccount = {
  id: 'acc-xyz789',
  email: 'commander@mars.fund',
  display_name: 'Commander',
  bio: null,
  avatar_url: null,
  status: 'active',
  roles: ['backer'],
  onboarding_completed: true,
  onboarding_step: 'completed',
  notification_preferences: {
    campaign_updates: true,
    milestone_completions: true,
    contribution_confirmations: true,
    new_campaign_recommendations: false,
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
        <PreferencesSettingsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('PreferencesSettingsPage', () => {
  it('renders loading skeleton initially', () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    renderWithProviders();
    expect(document.querySelector('.settings-page')).toBeInTheDocument();
  });

  it('renders heading and section label when data is loaded', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockAccount,
    });

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('NOTIFICATIONS');
    });
    expect(screen.getByText('02 — PREFERENCES')).toBeInTheDocument();
  });

  it('renders all preference rows', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockAccount,
    });

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getAllByText('Campaign Updates').length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText('Milestone Completions').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Security Alerts').length).toBeGreaterThan(0);
  });

  it('disables Save Preferences button when no changes', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockAccount,
    });

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save Preferences' })).toBeDisabled();
    });
  });

  it('enables Save Preferences when a toggle is changed', async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockAccount,
    });

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getAllByRole('switch')).toHaveLength(6);
    });

    // Toggle "Platform Announcements" (currently false)
    const platformToggle = screen.getByRole('switch', { name: /platform announcements/i });
    await user.click(platformToggle);

    expect(screen.getByRole('button', { name: 'Save Preferences' })).toBeEnabled();
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
        json: async () => ({
          ...mockAccount,
          notification_preferences: {
            ...mockAccount.notification_preferences,
            platform_announcements: true,
          },
        }),
      });

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getAllByRole('switch')).toHaveLength(6);
    });

    const platformToggle = screen.getByRole('switch', { name: /platform announcements/i });
    await user.click(platformToggle);
    await user.click(screen.getByRole('button', { name: 'Save Preferences' }));

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Preferences updated successfully.');
    });
  });

  it('shows error when save fails', async () => {
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
      expect(screen.getAllByRole('switch')).toHaveLength(6);
    });

    const platformToggle = screen.getByRole('switch', { name: /platform announcements/i });
    await user.click(platformToggle);
    await user.click(screen.getByRole('button', { name: 'Save Preferences' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        "We couldn't save your preferences. Try again.",
      );
    });
  });

  it('security alerts toggle is disabled', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockAccount,
    });

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByRole('switch', { name: /security alerts/i })).toHaveAttribute(
        'aria-disabled',
        'true',
      );
    });
  });
});
