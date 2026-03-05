import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CompletionStep } from './completion-step';

describe('CompletionStep', () => {
  it('renders the heading', () => {
    render(<CompletionStep displayName="Jane" onGoToDashboard={vi.fn()} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent("YOU'RE READY FOR MARS");
  });

  it('shows personalised greeting with display name', () => {
    render(<CompletionStep displayName="Commander Smith" onGoToDashboard={vi.fn()} />);
    expect(screen.getByText('Welcome aboard, Commander Smith')).toBeInTheDocument();
  });

  it('shows fallback greeting when no display name', () => {
    render(<CompletionStep displayName={null} onGoToDashboard={vi.fn()} />);
    expect(screen.getByText('Welcome aboard, Mission Operative')).toBeInTheDocument();
  });

  it('renders the Go to Dashboard button', () => {
    render(<CompletionStep displayName={null} onGoToDashboard={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Go to Dashboard' })).toBeInTheDocument();
  });

  it('calls onGoToDashboard when button is clicked', async () => {
    const user = userEvent.setup();
    const onGoToDashboard = vi.fn();
    render(<CompletionStep displayName="Jane" onGoToDashboard={onGoToDashboard} />);
    await user.click(screen.getByRole('button', { name: 'Go to Dashboard' }));
    expect(onGoToDashboard).toHaveBeenCalledOnce();
  });
});
