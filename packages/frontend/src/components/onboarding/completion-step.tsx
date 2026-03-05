import type { ReactElement } from 'react';

interface CompletionStepProps {
  readonly displayName: string | null;
  readonly onGoToDashboard: () => void;
}

export function CompletionStep({
  displayName,
  onGoToDashboard,
}: CompletionStepProps): ReactElement {
  const greeting = displayName
    ? `Welcome aboard, ${displayName}`
    : 'Welcome aboard, Mission Operative';

  return (
    <>
      <div className="completion-step" aria-live="polite">
        <div aria-hidden="true" className="completion-step__icon">
          <svg
            width="64"
            height="64"
            viewBox="0 0 64 64"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <circle cx="32" cy="32" r="30" stroke="currentColor" strokeWidth="3" fill="none" />
            <path
              d="M20 32L28 40L44 24"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h1 className="completion-step__heading">YOU&apos;RE READY FOR MARS</h1>
        <p className="completion-step__greeting">{greeting}</p>
        <button type="button" className="completion-step__cta" onClick={onGoToDashboard}>
          Go to Dashboard
        </button>
      </div>
      <style>{`
        .completion-step {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 48px 0;
          position: relative;
        }

        .completion-step::before {
          content: '';
          position: absolute;
          inset: 0;
          background: var(--gradient-celebration);
          opacity: 0.3;
          pointer-events: none;
          border-radius: var(--radius-card);
        }

        .completion-step__icon {
          color: var(--color-status-success);
          margin-bottom: 24px;
          animation:
            completion-scale var(--motion-enter-emphasis-duration) var(--motion-enter-emphasis-easing),
            completion-fade var(--motion-enter-emphasis-duration) var(--motion-enter-emphasis-easing);
          position: relative;
        }

        @keyframes completion-scale {
          from { transform: scale(0.8); }
          to { transform: scale(1); }
        }

        @keyframes completion-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @media (prefers-reduced-motion: reduce) {
          .completion-step__icon {
            animation: none;
          }
        }

        .completion-step__heading {
          font-family: var(--font-display);
          font-size: 40px;
          font-weight: 400;
          letter-spacing: 0.04em;
          color: var(--color-text-primary);
          text-transform: uppercase;
          line-height: 1;
          margin-bottom: 12px;
          position: relative;
        }

        @media (min-width: 640px) {
          .completion-step__heading {
            font-size: 56px;
          }
        }

        .completion-step__greeting {
          font-family: var(--font-body);
          font-size: 16px;
          font-weight: 400;
          line-height: 1.7;
          color: var(--color-text-secondary);
          margin-bottom: 40px;
          position: relative;
        }

        .completion-step__cta {
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
          position: relative;
        }

        .completion-step__cta:hover {
          opacity: 0.9;
        }

        .completion-step__cta:focus-visible {
          outline: 2px solid var(--color-action-primary-hover);
          outline-offset: 2px;
        }
      `}</style>
    </>
  );
}
