import { type ReactElement } from 'react';
import { Button } from '../../ui/Button';

interface OnboardingWelcomeStepProps {
  readonly onNext: () => void;
}

/**
 * OnboardingWelcomeStep — Step 1 of the onboarding flow.
 * Brand-appropriate welcome with primary CTA.
 */
export function OnboardingWelcomeStep({ onNext }: OnboardingWelcomeStepProps): ReactElement {
  return (
    <div>
      <p
        style={{
          fontFamily: 'var(--font-data)',
          fontSize: '11px',
          fontWeight: 400,
          letterSpacing: '0.3em',
          textTransform: 'uppercase',
          color: 'var(--color-text-accent)',
          marginBottom: '16px',
          marginTop: 0,
        }}
      >
        01 — WELCOME
      </p>
      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '56px',
          fontWeight: 400,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: 'var(--color-text-primary)',
          marginBottom: '16px',
          marginTop: 0,
          lineHeight: 1.1,
        }}
      >
        YOUR MISSION STARTS HERE.
      </h1>
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '16px',
          fontWeight: 400,
          lineHeight: 1.7,
          color: 'var(--color-text-secondary)',
          marginBottom: '40px',
          marginTop: 0,
        }}
      >
        Welcome to Mars Mission Fund. Back the missions that matter, support the engineering that
        gets us there, and be part of the most ambitious journey humanity has ever taken.
      </p>
      <Button
        variant="primary"
        onClick={onNext}
        type="button"
      >
        Get Started
      </Button>
    </div>
  );
}




























