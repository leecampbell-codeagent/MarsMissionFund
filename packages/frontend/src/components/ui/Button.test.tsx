import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  it('renders with primary variant by default', () => {
    render(<Button>Get Started</Button>);
    const btn = screen.getByRole('button', { name: 'Get Started' });
    expect(btn).toBeInTheDocument();
  });

  it('calls onClick when clicked', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click me</Button>);
    await user.click(screen.getByRole('button', { name: 'Click me' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('is disabled when disabled=true', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick}>Disabled</Button>);
    const btn = screen.getByRole('button', { name: 'Disabled' });
    expect(btn).toBeDisabled();
    await user.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('shows spinner when isLoading=true', () => {
    render(<Button isLoading>Saving</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    // Spinner is present
    expect(btn.querySelector('svg')).toBeInTheDocument();
  });

  it('renders as submit button when type=submit', () => {
    render(<Button type="submit">Submit</Button>);
    expect(screen.getByRole('button', { name: 'Submit' })).toHaveAttribute('type', 'submit');
  });

  it('applies aria-label when provided', () => {
    render(<Button aria-label="Skip profile setup for now">Skip</Button>);
    expect(screen.getByRole('button', { name: 'Skip profile setup for now' })).toBeInTheDocument();
  });
});




























