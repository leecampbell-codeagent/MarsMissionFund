import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { OnboardingProfileStep } from './onboarding-profile-step';

describe('OnboardingProfileStep', () => {
  const defaultProps = {
    onNext: vi.fn(),
    onBack: vi.fn(),
    onSkip: vi.fn(),
  };

  it('renders the section label', () => {
    render(<OnboardingProfileStep {...defaultProps} />);
    expect(screen.getByText('03 — YOUR PROFILE')).toBeInTheDocument();
  });

  it('renders the heading', () => {
    render(<OnboardingProfileStep {...defaultProps} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('TELL US ABOUT YOURSELF.');
  });

  it('renders display name and bio fields', () => {
    render(<OnboardingProfileStep {...defaultProps} />);
    expect(screen.getByLabelText(/DISPLAY NAME/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/BIO/i)).toBeInTheDocument();
  });

  it('pre-fills form with initialValues', () => {
    render(
      <OnboardingProfileStep
        {...defaultProps}
        initialValues={{ displayName: 'Ada Lovelace', bio: 'Mars fan' }}
      />,
    );
    expect(screen.getByLabelText(/DISPLAY NAME/i)).toHaveValue('Ada Lovelace');
    expect(screen.getByLabelText(/BIO/i)).toHaveValue('Mars fan');
  });

  it('validates displayName max length and shows error', async () => {
    const user = userEvent.setup();
    render(<OnboardingProfileStep {...defaultProps} />);
    const input = screen.getByLabelText(/DISPLAY NAME/i);
    await user.type(input, 'A'.repeat(256));
    await user.click(screen.getByRole('button', { name: /Save and continue/i }));
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('calls onSkip when Skip for now is clicked', async () => {
    const user = userEvent.setup();
    const onSkip = vi.fn();
    render(<OnboardingProfileStep {...defaultProps} onSkip={onSkip} />);
    await user.click(screen.getByRole('button', { name: /Skip profile setup for now/i }));
    expect(onSkip).toHaveBeenCalledOnce();
  });

  it('calls onBack when Back is clicked', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    render(<OnboardingProfileStep {...defaultProps} onBack={onBack} />);
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('disables save button while isSaving=true', () => {
    render(<OnboardingProfileStep {...defaultProps} isSaving />);
    expect(screen.getByRole('button', { name: /Saving/i })).toBeDisabled();
  });

  it('shows API error message when error prop is set', () => {
    render(
      <OnboardingProfileStep {...defaultProps} error="We couldn't save your profile. Try again." />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      "We couldn't save your profile. Try again.",
    );
  });

  it('calls onNext with form data on valid submit', async () => {
    const user = userEvent.setup();
    const onNext = vi.fn();
    render(<OnboardingProfileStep {...defaultProps} onNext={onNext} />);
    await user.type(screen.getByLabelText(/DISPLAY NAME/i), 'Ada Lovelace');
    await user.type(screen.getByLabelText(/BIO/i), 'Propulsion engineer');
    await user.click(screen.getByRole('button', { name: /Save and continue/i }));
    expect(onNext).toHaveBeenCalledWith({
      displayName: 'Ada Lovelace',
      bio: 'Propulsion engineer',
    });
  });

  it('shows character count for bio', () => {
    render(<OnboardingProfileStep {...defaultProps} />);
    expect(screen.getByText('0 / 500')).toBeInTheDocument();
  });
});
