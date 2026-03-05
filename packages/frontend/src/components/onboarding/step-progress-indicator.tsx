import { type ReactElement } from 'react';

interface StepInfo {
  readonly label: string;
}

interface StepProgressIndicatorProps {
  readonly currentStep: number;
  readonly steps: readonly StepInfo[];
}

export function StepProgressIndicator({
  currentStep,
  steps,
}: StepProgressIndicatorProps): ReactElement {
  const currentStepLabel = steps[currentStep]?.label ?? '';

  return (
    <>
      <nav
        aria-label="Onboarding progress"
        className="step-progress"
      >
        <ol className="step-progress__list" aria-hidden="false">
          {steps.map((step, index) => {
            const isCompleted = index < currentStep;
            const isCurrent = index === currentStep;
            const isFuture = index > currentStep;
            const isLast = index === steps.length - 1;

            let statusText = 'upcoming';
            if (isCompleted) statusText = 'completed';
            if (isCurrent) statusText = 'current';

            return (
              <li key={step.label} className="step-progress__item">
                <div
                  className={`step-progress__dot${isCompleted ? ' step-progress__dot--completed' : ''}${isCurrent ? ' step-progress__dot--current' : ''}${isFuture ? ' step-progress__dot--future' : ''}`}
                  aria-label={`Step ${index + 1}: ${step.label}, ${statusText}`}
                  aria-current={isCurrent ? 'step' : undefined}
                >
                  <span className="step-progress__dot-number" aria-hidden="true">
                    {index + 1}
                  </span>
                </div>
                <span
                  className={`step-progress__label${isFuture ? ' step-progress__label--future' : ''}`}
                  aria-hidden="true"
                >
                  {step.label}
                </span>
                {!isLast && (
                  <div
                    className={`step-progress__line${isCompleted ? ' step-progress__line--completed' : ''}`}
                    aria-hidden="true"
                  />
                )}
              </li>
            );
          })}
        </ol>
        <p className="step-progress__mobile-label" aria-live="polite">
          Step {currentStep + 1} of {steps.length} — {currentStepLabel}
        </p>
      </nav>
      <style>{`
        .step-progress {
          margin-bottom: 32px;
        }

        .step-progress__list {
          display: flex;
          align-items: flex-start;
          justify-content: center;
          list-style: none;
          margin: 0;
          padding: 0;
        }

        .step-progress__item {
          display: flex;
          flex-direction: column;
          align-items: center;
          position: relative;
        }

        .step-progress__item:not(:last-child) {
          flex-direction: row;
          align-items: flex-start;
        }

        .step-progress__dot {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          /* expand touch target */
          padding: 8px;
          margin: -8px;
          position: relative;
          z-index: 1;
        }

        .step-progress__dot--completed,
        .step-progress__dot--current {
          background: var(--color-action-primary);
          border: none;
        }

        .step-progress__dot--current {
          box-shadow: 0 0 0 4px var(--color-action-primary-shadow);
        }

        .step-progress__dot--future {
          background: var(--color-bg-input);
          border: 1px solid var(--color-border-input);
        }

        .step-progress__dot-number {
          font-family: var(--font-body);
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.01em;
          line-height: 1;
        }

        .step-progress__dot--completed .step-progress__dot-number,
        .step-progress__dot--current .step-progress__dot-number {
          color: var(--color-action-primary-text);
        }

        .step-progress__dot--future .step-progress__dot-number {
          color: var(--color-text-tertiary);
        }

        .step-progress__line {
          width: 32px;
          height: 2px;
          background: var(--color-border-input);
          align-self: center;
          flex-shrink: 0;
          margin: 0 4px;
        }

        .step-progress__line--completed {
          background: var(--color-action-primary);
        }

        .step-progress__label {
          font-family: var(--font-body);
          font-size: 13px;
          font-weight: 400;
          line-height: 1.7;
          color: var(--color-text-secondary);
          margin-top: 8px;
          max-width: 80px;
          text-align: center;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .step-progress__label--future {
          color: var(--color-text-tertiary);
        }

        .step-progress__mobile-label {
          display: none;
          font-family: var(--font-body);
          font-size: 13px;
          font-weight: 400;
          color: var(--color-text-secondary);
          text-align: center;
          margin-top: 12px;
        }

        @media (max-width: 767px) {
          .step-progress__label {
            display: none;
          }

          .step-progress__mobile-label {
            display: block;
          }

          .step-progress__line {
            width: 16px;
          }
        }
      `}</style>
    </>
  );
}
