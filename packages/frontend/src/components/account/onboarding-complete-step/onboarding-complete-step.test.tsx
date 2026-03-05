import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OnboardingCompleteStep } from './onboarding-complete-step';

describe('OnboardingCompleteStep', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the "YOU\'RE IN." heading when no displayName', () => {
    render(<OnboardingCompleteStep />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent("YOU'RE IN.");
  });

  it('renders personalised heading when displayName is provided', () => {
    render(<OnboardingCompleteStep displayName="Ada" />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent("YOU'RE IN, ADA.");
  });

  it('renders body text about mission profile', () => {
    render(<OnboardingCompleteStep />);
    expect(screen.getByText(/Your mission profile is set/)).toBeInTheDocument();
  });

  it('shows redirect notice after 1 second', async () => {
    render(<OnboardingCompleteStep />);
    expect(screen.queryByText(/Taking you to the platform/)).not.toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(1100);
    });
    expect(screen.getByText(/Taking you to the platform/)).toBeInTheDocument();
  });

  it('redirect notice has role="status"', async () => {
    render(<OnboardingCompleteStep />);
    await act(async () => {
      vi.advanceTimersByTime(1100);
    });
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('has aria-live="polite" wrapper', () => {
    const { container } = render(<OnboardingCompleteStep />);
    const liveRegion = container.querySelector('[aria-live="polite"]');
    expect(liveRegion).toBeInTheDocument();
  });
});




























