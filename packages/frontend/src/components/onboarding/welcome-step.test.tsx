import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { WelcomeStep } from './welcome-step';

describe('WelcomeStep', () => {
  it('renders the welcome heading', () => {
    render(<WelcomeStep onContinue={vi.fn()} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('WELCOME TO THE MISSION');
  });

  it('renders the body text', () => {
    render(<WelcomeStep onContinue={vi.fn()} />);
    expect(screen.getByText(/Mars Mission Fund connects you/i)).toBeInTheDocument();
  });

  it('renders the Begin Setup button', () => {
    render(<WelcomeStep onContinue={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Begin Setup' })).toBeInTheDocument();
  });

  it('calls onContinue when Begin Setup is clicked', async () => {
    const user = userEvent.setup();
    const onContinue = vi.fn();
    render(<WelcomeStep onContinue={onContinue} />);
    await user.click(screen.getByRole('button', { name: 'Begin Setup' }));
    expect(onContinue).toHaveBeenCalledOnce();
  });

  it('shows loading state when isLoading is true', () => {
    render(<WelcomeStep onContinue={vi.fn()} isLoading />);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Setting up...')).toBeInTheDocument();
  });

  it('shows error message when error is provided', () => {
    render(
      <WelcomeStep onContinue={vi.fn()} error="Something went wrong. Let's try that again." />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      "Something went wrong. Let's try that again.",
    );
  });

  it('does not show error when error is null', () => {
    render(<WelcomeStep onContinue={vi.fn()} error={null} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
