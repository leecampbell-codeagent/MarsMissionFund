import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { OnboardingStepIndicator } from './onboarding-step-indicator';

describe('OnboardingStepIndicator', () => {
  it('renders step label correctly', () => {
    render(<OnboardingStepIndicator currentStep={1} />);
    expect(screen.getByText('STEP 1 OF 5')).toBeInTheDocument();
  });

  it('renders correct step label for step 3', () => {
    render(<OnboardingStepIndicator currentStep={3} totalSteps={5} />);
    expect(screen.getByText('STEP 3 OF 5')).toBeInTheDocument();
  });

  it('has correct progressbar role and aria attributes', () => {
    render(<OnboardingStepIndicator currentStep={2} totalSteps={5} />);
    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-valuenow', '2');
    expect(progressbar).toHaveAttribute('aria-valuemin', '1');
    expect(progressbar).toHaveAttribute('aria-valuemax', '5');
    expect(progressbar).toHaveAttribute('aria-label', 'Onboarding progress: step 2 of 5');
  });

  it('renders 5 segment divs', () => {
    const { container } = render(<OnboardingStepIndicator currentStep={1} />);
    const segments = container.querySelectorAll('[aria-hidden="true"]');
    expect(segments.length).toBeGreaterThanOrEqual(5);
  });

  it('supports custom totalSteps', () => {
    render(<OnboardingStepIndicator currentStep={2} totalSteps={3} />);
    expect(screen.getByText('STEP 2 OF 3')).toBeInTheDocument();
  });
});




























