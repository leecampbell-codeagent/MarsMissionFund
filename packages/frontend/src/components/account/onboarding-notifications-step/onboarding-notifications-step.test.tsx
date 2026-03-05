import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { OnboardingNotificationsStep } from './onboarding-notifications-step';

describe('OnboardingNotificationsStep', () => {
  const defaultProps = {
    onNext: vi.fn(),
    onBack: vi.fn(),
  };

  it('renders the section label', () => {
    render(<OnboardingNotificationsStep {...defaultProps} />);
    expect(screen.getByText('04 — NOTIFICATIONS')).toBeInTheDocument();
  });

  it('renders the heading', () => {
    render(<OnboardingNotificationsStep {...defaultProps} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('STAY IN THE LOOP.');
  });

  it('renders 6 toggle switches', () => {
    render(<OnboardingNotificationsStep {...defaultProps} />);
    expect(screen.getAllByRole('switch')).toHaveLength(6);
  });

  it('security alerts toggle is locked (aria-disabled)', () => {
    render(<OnboardingNotificationsStep {...defaultProps} />);
    const securitySwitch = screen.getByRole('switch', { name: /Security Alerts/i });
    expect(securitySwitch).toHaveAttribute('aria-disabled', 'true');
  });

  it('calls onBack when Back is clicked', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    render(<OnboardingNotificationsStep {...defaultProps} onBack={onBack} />);
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('calls onNext with preferences when Save preferences is clicked', async () => {
    const user = userEvent.setup();
    const onNext = vi.fn();
    render(<OnboardingNotificationsStep {...defaultProps} onNext={onNext} />);
    await user.click(screen.getByRole('button', { name: /Save preferences/i }));
    expect(onNext).toHaveBeenCalledOnce();
  });

  it('disables save button while isSaving=true', () => {
    render(<OnboardingNotificationsStep {...defaultProps} isSaving />);
    expect(screen.getByRole('button', { name: /Saving/i })).toBeDisabled();
  });

  it('fieldset has notification preferences legend', () => {
    render(<OnboardingNotificationsStep {...defaultProps} />);
    expect(screen.getByText('Notification preferences')).toBeInTheDocument();
  });
});
