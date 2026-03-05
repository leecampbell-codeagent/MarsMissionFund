import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { NotificationToggleRow } from './notification-toggle-row';

describe('NotificationToggleRow', () => {
  const defaultProps = {
    id: 'campaignUpdates',
    label: 'Campaign Updates',
    description: "News from missions you're backing.",
    checked: true,
    onChange: vi.fn(),
  };

  it('renders label and description', () => {
    render(<NotificationToggleRow {...defaultProps} />);
    expect(screen.getByText('Campaign Updates')).toBeInTheDocument();
    expect(screen.getByText(/News from missions/)).toBeInTheDocument();
  });

  it('has correct aria-checked when checked=true', () => {
    render(<NotificationToggleRow {...defaultProps} checked />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });

  it('has correct aria-checked when checked=false', () => {
    render(<NotificationToggleRow {...defaultProps} checked={false} />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  });

  it('calls onChange when clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<NotificationToggleRow {...defaultProps} onChange={onChange} />);
    await user.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledWith(false); // was true, toggles to false
  });

  it('is aria-disabled when locked=true', () => {
    render(<NotificationToggleRow {...defaultProps} locked />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-disabled', 'true');
  });

  it('does not call onChange when locked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<NotificationToggleRow {...defaultProps} locked onChange={onChange} />);
    await user.click(screen.getByRole('switch'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('has tabIndex=-1 when locked', () => {
    render(<NotificationToggleRow {...defaultProps} locked />);
    expect(screen.getByRole('switch')).toHaveAttribute('tabindex', '-1');
  });

  it('has accessible label including state via aria-label', () => {
    render(<NotificationToggleRow {...defaultProps} checked label="Campaign Updates" />);
    const toggle = screen.getByRole('switch');
    // aria-label contains the full state description
    expect(toggle).toHaveAttribute('aria-label', 'Campaign Updates notifications, on');
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });

  it('includes "always on" in locked label', () => {
    render(<NotificationToggleRow {...defaultProps} locked label="Security Alerts" />);
    expect(screen.getByRole('switch')).toHaveAttribute(
      'aria-label',
      'Security Alerts notifications, on, always on',
    );
  });
});




























