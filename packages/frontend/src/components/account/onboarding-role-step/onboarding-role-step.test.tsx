import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { OnboardingRoleStep } from './onboarding-role-step';

describe('OnboardingRoleStep', () => {
  const defaultProps = {
    onNext: vi.fn(),
    onBack: vi.fn(),
  };

  it('renders the section label', () => {
    render(<OnboardingRoleStep {...defaultProps} />);
    expect(screen.getByText('02 — YOUR ROLE')).toBeInTheDocument();
  });

  it('renders the heading', () => {
    render(<OnboardingRoleStep {...defaultProps} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'HOW WILL YOU JOIN THE MISSION?',
    );
  });

  it('renders all 3 role cards in a radiogroup', () => {
    render(<OnboardingRoleStep {...defaultProps} />);
    const group = screen.getByRole('radiogroup', { name: 'Select your role' });
    expect(group).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(3);
  });

  it('Continue button is disabled when no selection is made', () => {
    render(<OnboardingRoleStep {...defaultProps} />);
    expect(screen.getByRole('button', { name: /Continue/i })).toBeDisabled();
  });

  it('enables Continue button after role selection', async () => {
    const user = userEvent.setup();
    render(<OnboardingRoleStep {...defaultProps} />);
    await user.click(screen.getByRole('radio', { name: /Back Missions/i }));
    expect(screen.getByRole('button', { name: /Continue/i })).not.toBeDisabled();
  });

  it('calls onNext when Continue is clicked after selection', async () => {
    const user = userEvent.setup();
    const onNext = vi.fn();
    render(<OnboardingRoleStep {...defaultProps} onNext={onNext} />);
    await user.click(screen.getByRole('radio', { name: /Create a Campaign/i }));
    await user.click(screen.getByRole('button', { name: /Continue/i }));
    expect(onNext).toHaveBeenCalledOnce();
  });

  it('calls onBack when Back is clicked', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    render(<OnboardingRoleStep {...defaultProps} onBack={onBack} />);
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('selects a card and sets aria-checked=true', async () => {
    const user = userEvent.setup();
    render(<OnboardingRoleStep {...defaultProps} />);
    const backerCard = screen.getByRole('radio', { name: /Back Missions/i });
    await user.click(backerCard);
    expect(backerCard).toHaveAttribute('aria-checked', 'true');
  });
});
