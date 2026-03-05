import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { UserProfile } from '../../../api/account-api';
import { ProfileCard } from './profile-card';

const mockUser: UserProfile = {
  id: 'usr_01',
  clerkUserId: 'user_clerk_01',
  email: 'ada@example.com',
  displayName: 'Ada Lovelace',
  bio: 'Mars enthusiast',
  avatarUrl: null,
  accountStatus: 'active',
  roles: ['backer'],
  kycStatus: 'not_started',
  onboardingCompleted: true,
  onboardingStep: 'complete',
  notificationPrefs: {
    campaignUpdates: true,
    milestoneCompletions: true,
    contributionConfirmations: true,
    recommendations: true,
    securityAlerts: true,
    platformAnnouncements: false,
  },
  lastSeenAt: '2026-03-05T12:00:00Z',
  createdAt: '2026-03-01T10:00:00Z',
  updatedAt: '2026-03-05T12:00:00Z',
};

describe('ProfileCard', () => {
  it('renders display name when present', () => {
    render(<ProfileCard user={mockUser} />);
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
  });

  it('renders initials avatar when avatarUrl is null', () => {
    render(<ProfileCard user={mockUser} />);
    // Should show initials AL
    expect(screen.getByText('AL')).toBeInTheDocument();
  });

  it('renders email address', () => {
    render(<ProfileCard user={mockUser} />);
    expect(screen.getByText('ada@example.com')).toBeInTheDocument();
  });

  it('renders email as name fallback when displayName is null', () => {
    const userNoName = { ...mockUser, displayName: null };
    render(<ProfileCard user={userNoName} />);
    // Email appears as the name value
    const emailElements = screen.getAllByText('ada@example.com');
    expect(emailElements.length).toBeGreaterThan(0);
  });

  it('renders role badges for all assigned roles', () => {
    render(<ProfileCard user={{ ...mockUser, roles: ['backer', 'creator'] }} />);
    expect(screen.getByText('Backer')).toBeInTheDocument();
    expect(screen.getByText('Creator')).toBeInTheDocument();
  });

  it('renders KYC badge as "Identity verification pending" for not_started', () => {
    render(<ProfileCard user={mockUser} />);
    expect(screen.getByText('Identity verification pending')).toBeInTheDocument();
  });

  it('renders loading skeleton when isLoading=true', () => {
    const { container } = render(<ProfileCard user={null} isLoading />);
    const loadingEl = container.querySelector('[aria-busy="true"]');
    expect(loadingEl).toBeInTheDocument();
    expect(loadingEl).toHaveAttribute('aria-label', 'Loading profile');
  });

  it('renders error state with sign-in link', () => {
    render(<ProfileCard user={null} isError />);
    expect(screen.getByText("We couldn't load your profile.")).toBeInTheDocument();
    expect(screen.getByText('Try signing in again.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Sign in/i })).toBeInTheDocument();
  });

  it('renders account status badge', () => {
    render(<ProfileCard user={mockUser} />);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });
});
