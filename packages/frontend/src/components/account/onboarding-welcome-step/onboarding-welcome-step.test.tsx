import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { OnboardingWelcomeStep } from './onboarding-welcome-step';

describe('OnboardingWelcomeStep', () => {
  it('renders the section label', () => {
    render(<OnboardingWelcomeStep onNext={vi.fn()} />);
    expect(screen.getByText('01 — WELCOME')).toBeInTheDocument();
  });

  it('renders the heading', () => {
    render(<OnboardingWelcomeStep onNext={vi.fn()} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('YOUR MISSION STARTS HERE.');
  });

  it('renders the welcome body text', () => {
    render(<OnboardingWelcomeStep onNext={vi.fn()} />);
    expect(screen.getByText(/Welcome to Mars Mission Fund/)).toBeInTheDocument();
  });

  it('renders the Get Started CTA button', () => {
    render(<OnboardingWelcomeStep onNext={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Get Started' })).toBeInTheDocument();
  });

  it('calls onNext when Get Started is clicked', async () => {
    const user = userEvent.setup();
    const onNext = vi.fn();
    render(<OnboardingWelcomeStep onNext={onNext} />);
    await user.click(screen.getByRole('button', { name: 'Get Started' }));
    expect(onNext).toHaveBeenCalledOnce();
  });
});

























