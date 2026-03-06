import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import ProfilePage from './profile.js';

vi.mock('../hooks/use-current-user.js', () => ({
  useCurrentUser: vi.fn(),
}));

// Mock child components that use their own hooks
vi.mock('../components/profile/profile-edit-form.js', () => ({
  ProfileEditForm: () => <div data-testid="profile-edit-form">ProfileEditForm</div>,
}));

vi.mock('../components/profile/notification-preferences-form.js', () => ({
  NotificationPreferencesForm: () => (
    <div data-testid="notification-preferences-form">NotificationPreferencesForm</div>
  ),
}));

import { useCurrentUser } from '../hooks/use-current-user.js';

const mockUseCurrentUser = vi.mocked(useCurrentUser);
const mockRefetch = vi.fn();

const mockUserData = {
  data: {
    id: 'user-123',
    clerkUserId: 'clerk-123',
    email: 'test@example.com',
    displayName: 'Test User',
    bio: 'A test bio',
    avatarUrl: null,
    accountStatus: 'active',
    onboardingCompleted: true,
    onboardingStep: null,
    roles: ['backer'],
    notificationPreferences: {
      campaign_updates: true,
      milestone_completions: false,
      contribution_confirmations: true,
      new_recommendations: false,
      platform_announcements: true,
      security_alerts: true,
    },
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
};

describe('ProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCurrentUser.mockReturnValue({
      data: mockUserData,
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof useCurrentUser>);
  });

  it('renders loading spinner while loading', () => {
    mockUseCurrentUser.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof useCurrentUser>);

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
  });

  it('renders error state with retry button', () => {
    mockUseCurrentUser.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof useCurrentUser>);

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Failed to load profile/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('calls refetch when Retry is clicked', async () => {
    const user = userEvent.setup();
    mockUseCurrentUser.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof useCurrentUser>);

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(mockRefetch).toHaveBeenCalledOnce();
  });

  it('renders profile header with display name', () => {
    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Test User' })).toBeInTheDocument();
  });

  it('renders email address', () => {
    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    );

    expect(screen.getByText('test@example.com')).toBeInTheDocument();
  });

  it('renders role badges', () => {
    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    );

    expect(screen.getByText('backer')).toBeInTheDocument();
  });

  it('renders account status badge', () => {
    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    );

    expect(screen.getByText('active')).toBeInTheDocument();
  });

  it('renders ProfileEditForm component', () => {
    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('profile-edit-form')).toBeInTheDocument();
  });

  it('renders NotificationPreferencesForm component', () => {
    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('notification-preferences-form')).toBeInTheDocument();
  });

  it('falls back to email when displayName is null', () => {
    mockUseCurrentUser.mockReturnValue({
      data: {
        data: {
          ...mockUserData.data,
          displayName: null,
        },
      },
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof useCurrentUser>);

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'test@example.com' })).toBeInTheDocument();
  });

  it('renders avatar placeholder when no avatarUrl', () => {
    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText('Avatar placeholder')).toBeInTheDocument();
  });

  it('renders KYC status placeholder with link to /kyc', () => {
    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Identity verification not yet started/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Start verification/i })).toBeInTheDocument();
  });

  it('renders NotificationPreferencesForm (which contains always-on Security Alerts toggle)', () => {
    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    );

    // NotificationPreferencesForm is rendered; its Security Alerts always-on behavior
    // is covered by notification-preferences-form.test.tsx
    expect(screen.getByTestId('notification-preferences-form')).toBeInTheDocument();
  });
});
