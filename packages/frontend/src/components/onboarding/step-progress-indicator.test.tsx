import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StepProgressIndicator } from './step-progress-indicator';

const steps = [
  { label: 'Welcome' },
  { label: 'Role' },
  { label: 'Profile' },
  { label: 'Preferences' },
  { label: 'Complete' },
];

describe('StepProgressIndicator', () => {
  it('renders with navigation landmark', () => {
    render(<StepProgressIndicator currentStep={0} steps={steps} />);
    expect(screen.getByRole('navigation', { name: 'Onboarding progress' })).toBeInTheDocument();
  });

  it('marks the current step with aria-current="step"', () => {
    render(<StepProgressIndicator currentStep={2} steps={steps} />);
    const currentDot = screen.getByLabelText('Step 3: Profile, current');
    expect(currentDot).toHaveAttribute('aria-current', 'step');
  });

  it('marks completed steps correctly', () => {
    render(<StepProgressIndicator currentStep={2} steps={steps} />);
    expect(screen.getByLabelText('Step 1: Welcome, completed')).toBeInTheDocument();
    expect(screen.getByLabelText('Step 2: Role, completed')).toBeInTheDocument();
  });

  it('marks upcoming steps correctly', () => {
    render(<StepProgressIndicator currentStep={2} steps={steps} />);
    expect(screen.getByLabelText('Step 4: Preferences, upcoming')).toBeInTheDocument();
    expect(screen.getByLabelText('Step 5: Complete, upcoming')).toBeInTheDocument();
  });

  it('shows mobile label with current step info', () => {
    render(<StepProgressIndicator currentStep={1} steps={steps} />);
    expect(screen.getByText('Step 2 of 5 — Role')).toBeInTheDocument();
  });

  it('renders step 1 correctly as current', () => {
    render(<StepProgressIndicator currentStep={0} steps={steps} />);
    expect(screen.getByLabelText('Step 1: Welcome, current')).toHaveAttribute(
      'aria-current',
      'step',
    );
  });
});
