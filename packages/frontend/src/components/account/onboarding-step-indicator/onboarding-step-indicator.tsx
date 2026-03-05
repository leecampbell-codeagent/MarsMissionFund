import { type ReactElement } from 'react';

interface OnboardingStepIndicatorProps {
  readonly currentStep: number;
  readonly totalSteps?: number;
}

/**
 * OnboardingStepIndicator — shows progress through the onboarding flow.
 * Visual segmented progress bar with step label.
 * Implements design spec Section: Component OnboardingStepIndicator.
 */
export function OnboardingStepIndicator({
  currentStep,
  totalSteps = 5,
}: OnboardingStepIndicatorProps): ReactElement {
  const segments = Array.from({ length: totalSteps }, (_, i) => i + 1);

  return (
    <div
      role="progressbar"
      aria-valuenow={currentStep}
      aria-valuemin={1}
      aria-valuemax={totalSteps}
      aria-label={`Onboarding progress: step ${currentStep} of ${totalSteps}`}
      style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
    >
      <span
        style={{
          fontFamily: 'var(--font-data)',
          fontSize: '11px',
          fontWeight: 400,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: 'var(--color-text-tertiary)',
          marginBottom: '8px',
          display: 'block',
        }}
      >
        STEP {currentStep} OF {totalSteps}
      </span>
      <div style={{ display: 'flex', flexDirection: 'row', gap: '4px' }}>
        {segments.map((step) => {
          const isCompleted = step < currentStep;
          const isCurrent = step === currentStep;

          let background: string;
          if (isCompleted) {
            background = 'var(--color-action-primary)';
          } else if (isCurrent) {
            background = 'var(--gradient-action-primary)';
          } else {
            background = 'var(--color-progress-track)';
          }

          return (
            <div
              key={step}
              aria-hidden="true"
              style={{
                flex: 1,
                height: '4px',
                borderRadius: 'var(--radius-progress)',
                background,
                transition: `background-color var(--motion-hover)`,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}




























