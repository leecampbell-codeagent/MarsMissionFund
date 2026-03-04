import { type ReactElement } from 'react';

/**
 * Full-page loading screen displayed while Clerk's auth state initialises.
 * Uses a CSS-only spinner with brand tokens.
 */
export function AuthLoadingScreen(): ReactElement {
  return (
    <div className="auth-loading-screen" role="status" aria-label="Checking authentication">
      <div className="auth-loading-screen__spinner" />
      <p className="auth-loading-screen__text">Preparing your mission...</p>
      <style>{`
        .auth-loading-screen {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          flex: 1;
        }

        .auth-loading-screen__spinner {
          width: 40px;
          height: 40px;
          border: 3px solid var(--color-border-subtle);
          border-top: 3px solid var(--color-action-primary);
          border-radius: 50%;
          animation: auth-spin 800ms linear infinite;
        }

        @keyframes auth-spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .auth-loading-screen__spinner {
            animation: auth-pulse var(--motion-enter-emphasis-duration) ease-in-out infinite alternate;
            border-top-color: var(--color-action-primary);
            opacity: 0.5;
          }

          @keyframes auth-pulse {
            to {
              opacity: 1;
            }
          }
        }

        .auth-loading-screen__text {
          font-family: var(--font-body);
          font-size: 13px;
          font-weight: 400;
          line-height: 1.7;
          color: var(--color-text-tertiary);
          margin-top: 16px;
          animation: auth-fade-in var(--motion-enter-duration) var(--motion-enter-easing);
        }

        @keyframes auth-fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
