import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { NotificationPreferencesForm } from './notification-preferences-form.js';

vi.mock('../../hooks/use-update-notification-preferences.js', () => ({
  useUpdateNotificationPreferences: vi.fn(),
}));

import { useUpdateNotificationPreferences } from '../../hooks/use-update-notification-preferences.js';

const mockUseUpdateNotificationPreferences = vi.mocked(useUpdateNotificationPreferences);
const mockMutate = vi.fn();

const defaultPreferences = {
  campaign_updates: true,
  milestone_completions: false,
  contribution_confirmations: true,
  new_recommendations: false,
  platform_announcements: true,
  security_alerts: true,
};

describe('NotificationPreferencesForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUpdateNotificationPreferences.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useUpdateNotificationPreferences>);
  });

  it('renders all preference toggles', () => {
    render(<NotificationPreferencesForm initialPreferences={defaultPreferences} />);

    expect(screen.getByLabelText('Campaign Updates')).toBeInTheDocument();
    expect(screen.getByLabelText('Milestone Completions')).toBeInTheDocument();
    expect(screen.getByLabelText('Contribution Confirmations')).toBeInTheDocument();
    expect(screen.getByLabelText('New Recommendations')).toBeInTheDocument();
    expect(screen.getByLabelText('Platform Announcements')).toBeInTheDocument();
    expect(screen.getByLabelText('Security Alerts')).toBeInTheDocument();
  });

  it('Security Alerts is always checked and disabled', () => {
    render(<NotificationPreferencesForm initialPreferences={defaultPreferences} />);

    const securityAlerts = screen.getByLabelText('Security Alerts');
    expect(securityAlerts).toBeChecked();
    expect(securityAlerts).toBeDisabled();
  });

  it('calls mutate when form is submitted', async () => {
    const user = userEvent.setup();
    render(<NotificationPreferencesForm initialPreferences={defaultPreferences} />);

    await user.click(screen.getByRole('button', { name: 'SAVE PREFERENCES' }));

    expect(mockMutate).toHaveBeenCalledOnce();
  });

  it('shows error message on failure', () => {
    mockUseUpdateNotificationPreferences.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
      isError: true,
      error: new Error('Save failed'),
    } as unknown as ReturnType<typeof useUpdateNotificationPreferences>);

    render(<NotificationPreferencesForm initialPreferences={defaultPreferences} />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Save failed')).toBeInTheDocument();
  });

  it('shows loading spinner when pending', () => {
    mockUseUpdateNotificationPreferences.mockReturnValue({
      mutate: mockMutate,
      isPending: true,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useUpdateNotificationPreferences>);

    render(<NotificationPreferencesForm initialPreferences={defaultPreferences} />);

    expect(screen.getByRole('status', { name: 'Saving' })).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('toggles a preference when clicked', async () => {
    const user = userEvent.setup();
    render(<NotificationPreferencesForm initialPreferences={defaultPreferences} />);

    const milestoneToggle = screen.getByLabelText('Milestone Completions');
    expect(milestoneToggle).not.toBeChecked();

    await user.click(milestoneToggle);
    expect(milestoneToggle).toBeChecked();
  });
});
