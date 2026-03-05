import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ToggleSwitch } from './toggle-switch';

describe('ToggleSwitch', () => {
  it('renders with role="switch"', () => {
    const onChange = vi.fn();
    render(<ToggleSwitch id="test-toggle" checked={false} onChange={onChange} />);
    expect(screen.getByRole('switch')).toBeInTheDocument();
  });

  it('reflects unchecked state via aria-checked', () => {
    const onChange = vi.fn();
    render(<ToggleSwitch id="test-toggle" checked={false} onChange={onChange} />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  });

  it('reflects checked state via aria-checked', () => {
    const onChange = vi.fn();
    render(<ToggleSwitch id="test-toggle" checked={true} onChange={onChange} />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });

  it('calls onChange with true when clicked while unchecked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ToggleSwitch id="test-toggle" checked={false} onChange={onChange} />);
    await user.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('calls onChange with false when clicked while checked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ToggleSwitch id="test-toggle" checked={true} onChange={onChange} />);
    await user.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('does not call onChange when disabled', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ToggleSwitch id="test-toggle" checked={false} onChange={onChange} disabled />);
    await user.click(screen.getByRole('switch'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('has aria-disabled when disabled', () => {
    const onChange = vi.fn();
    render(<ToggleSwitch id="test-toggle" checked={true} onChange={onChange} disabled />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-disabled', 'true');
  });

  it('toggles on Space key press', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ToggleSwitch id="test-toggle" checked={false} onChange={onChange} />);
    const toggle = screen.getByRole('switch');
    toggle.focus();
    await user.keyboard(' ');
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('uses the provided id', () => {
    const onChange = vi.fn();
    render(<ToggleSwitch id="my-custom-id" checked={false} onChange={onChange} />);
    expect(screen.getByRole('switch')).toHaveAttribute('id', 'my-custom-id');
  });
});
