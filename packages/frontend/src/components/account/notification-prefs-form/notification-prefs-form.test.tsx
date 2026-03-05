import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { NotificationPrefsForm } from './notification-prefs-form';
import { type NotificationPrefs } from '../../../api/account-api';

const defaultPrefs: NotificationPrefs = {
  campaignUpdates: true,
  milestoneCompletions: true,
  contributionConfirmations: true,
  recommendations: true,
  securityAlerts: true,
  platformAnnouncements: false,
};

describe('NotificationPrefsForm', () => {
  it('renders all 6 preference categories', () => {
    render(
      <NotificationPrefsForm prefs={defaultPrefs} isLoading={false} isUpdating={false} onToggle={vi.fn()} />,
    );
    expect(screen.getByText('Campaign Updates')).toBeInTheDocument();
    expect(screen.getByText('Milestone Completions')).toBeInTheDocument();
    expect(screen.getByText('Contribution Confirmations')).toBeInTheDocument();
    expect(screen.getByText('Recommendations')).toBeInTheDocument();
    expect(screen.getByText('Platform Announcements')).toBeInTheDocument();
    expect(screen.getByText('Security Alerts')).toBeInTheDocument();
  });

  it('security alerts toggle is aria-disabled', () => {
    render(
      <NotificationPrefsForm prefs={defaultPrefs} isLoading={false} isUpdating={false} onToggle={vi.fn()} />,
    );
    const securitySwitch = screen.getByRole('switch', { name: /Security Alerts/i });
    expect(securitySwitch).toHaveAttribute('aria-disabled', 'true');
  });

  it('calls onToggle when recommendations toggled', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(
      <NotificationPrefsForm prefs={defaultPrefs} isLoading={false} isUpdating={false} onToggle={onToggle} />,
    );
    const recoSwitch = screen.getByRole('switch', { name: /Recommendations/i });
    await user.click(recoSwitch);
    expect(onToggle).toHaveBeenCalledWith('recommendations', false);
  });

  it('shows skeleton rows while loading', () => {
    const { container } = render(
      <NotificationPrefsForm prefs={null} isLoading isUpdating={false} onToggle={vi.fn()} />,
    );
    // When loading, no toggle switches rendered
    expect(screen.queryAllByRole('switch')).toHaveLength(0);
    // Should have skeleton rows (divs with animation style)
    expect(container.querySelectorAll('fieldset > div').length).toBe(6);
  });

  it('renders toggle switches when prefs are loaded', () => {
    render(
      <NotificationPrefsForm prefs={defaultPrefs} isLoading={false} isUpdating={false} onToggle={vi.fn()} />,
    );
    expect(screen.getAllByRole('switch').length).toBe(6);
  });

  it('fieldset has legend for accessibility', () => {
    render(
      <NotificationPrefsForm prefs={defaultPrefs} isLoading={false} isUpdating={false} onToggle={vi.fn()} />,
    );
    expect(screen.getByText('Notification preferences')).toBeInTheDocument();
  });
});




























