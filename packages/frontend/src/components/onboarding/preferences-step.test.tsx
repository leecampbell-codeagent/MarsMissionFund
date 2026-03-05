import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '../../api/account-api';
import { PreferencesStep } from './preferences-step';

describe('PreferencesStep', () => {
  const defaultProps = {
    preferences: DEFAULT_NOTIFICATION_PREFERENCES,
    onPreferenceChange: vi.fn(),
    onComplete: vi.fn(),
    onSkip: vi.fn(),
    onBack: vi.fn(),
  };

  it('renders the heading', () => {
    render(<PreferencesStep {...defaultProps} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('NOTIFICATION PREFERENCES');
  });

  it('renders all preference rows', () => {
    render(<PreferencesStep {...defaultProps} />);
    expect(screen.getAllByText('Campaign Updates').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Milestone Completions').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Contribution Confirmations').length).toBeGreaterThan(0);
    expect(screen.getAllByText('New Campaigns').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Platform Announcements').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Security Alerts').length).toBeGreaterThan(0);
  });

  it('renders toggle switches for each preference', () => {
    render(<PreferencesStep {...defaultProps} />);
    const switches = screen.getAllByRole('switch');
    expect(switches).toHaveLength(6);
  });

  it('security alerts toggle is disabled', () => {
    render(<PreferencesStep {...defaultProps} />);
    // The security alerts toggle should have aria-disabled=true
    const securityToggle = screen.getByRole('switch', { name: /security alerts/i });
    expect(securityToggle).toHaveAttribute('aria-disabled', 'true');
  });

  it('calls onPreferenceChange when a toggle is clicked', async () => {
    const user = userEvent.setup();
    const onPreferenceChange = vi.fn();
    render(<PreferencesStep {...defaultProps} onPreferenceChange={onPreferenceChange} />);
    // Click "Platform Announcements" toggle (currently false in defaults)
    const platformToggle = screen.getByRole('switch', { name: /platform announcements/i });
    await user.click(platformToggle);
    expect(onPreferenceChange).toHaveBeenCalledWith('platform_announcements', true);
  });

  it('calls onBack when Back is clicked', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    render(<PreferencesStep {...defaultProps} onBack={onBack} />);
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('calls onSkip when Skip is clicked', async () => {
    const user = userEvent.setup();
    const onSkip = vi.fn();
    render(<PreferencesStep {...defaultProps} onSkip={onSkip} />);
    await user.click(screen.getByRole('button', { name: 'Skip' }));
    expect(onSkip).toHaveBeenCalledOnce();
  });

  it('calls onComplete when Complete Setup is clicked', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<PreferencesStep {...defaultProps} onComplete={onComplete} />);
    await user.click(screen.getByRole('button', { name: 'Complete Setup' }));
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it('shows loading state on Complete button', () => {
    render(<PreferencesStep {...defaultProps} isLoading />);
    const btn = screen.getByRole('button', { name: /saving/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-busy', 'true');
  });

  it('shows error message when provided', () => {
    render(<PreferencesStep {...defaultProps} error="Save failed. Try again." />);
    expect(screen.getByRole('alert')).toHaveTextContent('Save failed. Try again.');
  });
});
