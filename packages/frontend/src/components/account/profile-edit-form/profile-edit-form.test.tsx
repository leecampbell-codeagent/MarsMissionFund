import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ProfileEditForm } from './profile-edit-form';
import { type UserProfile } from '../../../api/account-api';

const mockUser: UserProfile = {
  id: 'usr_01',
  clerkUserId: 'user_clerk_01',
  email: 'ada@example.com',
  displayName: 'Ada Lovelace',
  bio: 'Propulsion engineer',
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
  lastSeenAt: null,
  createdAt: '2026-03-01T10:00:00Z',
  updatedAt: '2026-03-01T10:00:00Z',
};

describe('ProfileEditForm', () => {
  it('renders pre-filled form with current values', () => {
    render(<ProfileEditForm user={mockUser} onSave={vi.fn()} />);
    expect(screen.getByLabelText(/DISPLAY NAME/i)).toHaveValue('Ada Lovelace');
    expect(screen.getByLabelText(/BIO/i)).toHaveValue('Propulsion engineer');
  });

  it('validates displayName max 255 chars with inline error', async () => {
    const user = userEvent.setup();
    render(<ProfileEditForm user={mockUser} onSave={vi.fn()} />);
    const input = screen.getByLabelText(/DISPLAY NAME/i);
    await user.clear(input);
    await user.type(input, 'A'.repeat(256));
    await user.click(screen.getByRole('button', { name: /Save changes/i }));
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('validates bio max 500 chars', async () => {
    const user = userEvent.setup();
    render(<ProfileEditForm user={mockUser} onSave={vi.fn()} />);
    const textarea = screen.getByLabelText(/BIO/i);
    await user.clear(textarea);
    await user.type(textarea, 'X'.repeat(501));
    await user.click(screen.getByRole('button', { name: /Save changes/i }));
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('calls onSave with form data on submit', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<ProfileEditForm user={mockUser} onSave={onSave} />);
    await user.click(screen.getByRole('button', { name: /Save changes/i }));
    expect(onSave).toHaveBeenCalledWith({
      displayName: 'Ada Lovelace',
      bio: 'Propulsion engineer',
    });
  });

  it('disables save button while isSaving=true', () => {
    render(<ProfileEditForm user={mockUser} onSave={vi.fn()} isSaving />);
    expect(screen.getByRole('button', { name: /Saving/i })).toBeDisabled();
  });

  it('shows Saved label and success variant when isSuccess=true', () => {
    render(<ProfileEditForm user={mockUser} onSave={vi.fn()} isSuccess />);
    expect(screen.getByText('Saved')).toBeInTheDocument();
  });

  it('shows error banner when error prop is set', () => {
    render(
      <ProfileEditForm
        user={mockUser}
        onSave={vi.fn()}
        error="We couldn't save your changes. Try again."
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent("We couldn't save your changes.");
  });

  it('has accessible form label', () => {
    render(<ProfileEditForm user={mockUser} onSave={vi.fn()} />);
    expect(screen.getByRole('form', { name: 'Edit profile' })).toBeInTheDocument();
  });
});




























