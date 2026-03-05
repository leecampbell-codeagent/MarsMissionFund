import type { ReactElement } from 'react';

interface WelcomeStepProps {
  readonly onContinue: () => void;
  readonly isLoading?: boolean;
  readonly error?: string | null;
}

export function WelcomeStep({
  onContinue,
  isLoading = false,
  error = null,
}: WelcomeStepProps): ReactElement {
  return (
    <>
      <div className="welcome-step">
        <h1 className="welcome-step__heading">WELCOME TO THE MISSION</h1>
        <p className="welcome-step__body">
          Mars Mission Fund connects you with the projects making interplanetary life a reality.
          Let&apos;s set up your mission profile in a few quick steps.
        </p>
        {error && (
          <p className="welcome-step__error" role="alert">
            {error}
          </p>
        )}
        <button
          type="button"
          className="welcome-step__cta"
          onClick={onContinue}
          disabled={isLoading}
          aria-busy={isLoading}
        >
          {isLoading ? (
            <>
              <span className="welcome-step__spinner" aria-hidden="true" />
              <span>Setting up...</span>
            </>
          ) : (
            'Begin Setup'
          )}
        </button>
      </div>
      <style>{`
        .welcome-step {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }

        .welcome-step__heading {
          font-family: var(--font-display);
          font-size: 40px;
          font-weight: 400;
          letter-spacing: 0.04em;
          color: var(--color-text-primary);
          text-transform: uppercase;
          line-height: 1;
          margin-bottom: 16px;
        }

        @media (min-width: 640px) {
          .welcome-step__heading {
            font-size: 56px;
          }
        }

        .welcome-step__body {
          font-family: var(--font-body);
          font-size: 16px;
          font-weight: 400;
          line-height: 1.7;
          color: var(--color-text-secondary);
          max-width: 480px;
          margin: 0 auto 40px;
        }

        .welcome-step__error {
          font-family: var(--font-body);
          font-size: 13px;
          font-weight: 400;
          line-height: 1.7;
          color: var(--color-text-error);
          margin-bottom: 16px;
        }

        .welcome-step__cta {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: var(--gradient-action-primary);
          color: var(--color-action-primary-text);
          border: none;
          border-radius: var(--radius-button);
          font-family: var(--font-body);
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 0.01em;
          padding: 12px 32px;
          cursor: pointer;
          box-shadow: 0 4px 16px var(--color-action-primary-shadow);
          transition: opacity var(--motion-hover-duration) var(--motion-hover-easing);
        }

        .welcome-step__cta:hover:not(:disabled) {
          opacity: 0.9;
        }

        .welcome-step__cta:focus-visible {
          outline: 2px solid var(--color-action-primary-hover);
          outline-offset: 2px;
        }

        .welcome-step__cta:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .welcome-step__spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(245, 248, 255, 0.3);
          border-top-color: var(--color-action-primary-text);
          border-radius: 50%;
          animation: welcome-spin 800ms linear infinite;
          flex-shrink: 0;
        }

        @keyframes welcome-spin {
          to { transform: rotate(360deg); }
        }

        @media (prefers-reduced-motion: reduce) {
          .welcome-step__spinner {
            animation: none;
            opacity: 0.5;
          }
        }
      `}</style>
    </>
  );
}
