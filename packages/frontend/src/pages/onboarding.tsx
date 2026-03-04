import { type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Onboarding placeholder page.
 * Stub for feat-004 with a "Skip for now" button.
 */
export default function OnboardingPlaceholder(): ReactElement {
  const navigate = useNavigate();

  function handleSkip(): void {
    navigate('/dashboard');
  }

  return (
    <section className="onboarding-placeholder">
      <h1 className="onboarding-placeholder__title">ONBOARDING</h1>
      <p className="onboarding-placeholder__body">
        Onboarding coming soon. We&apos;re building your mission profile.
      </p>
      <button
        type="button"
        className="onboarding-placeholder__skip"
        onClick={handleSkip}
      >
        Skip for now
      </button>
      <style>{`
        .onboarding-placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          flex: 1;
          text-align: center;
          padding: 48px 0;
          max-width: 600px;
          margin: 0 auto;
        }

        .onboarding-placeholder__title {
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
          .onboarding-placeholder__title {
            font-size: 56px;
          }
        }

        .onboarding-placeholder__body {
          font-family: var(--font-body);
          font-size: 16px;
          font-weight: 400;
          line-height: 1.7;
          color: var(--color-text-secondary);
          margin-bottom: 32px;
        }

        .onboarding-placeholder__skip {
          background-color: var(--color-action-secondary-bg);
          color: var(--color-action-secondary-text);
          border: 1px solid var(--color-action-secondary-border);
          border-radius: var(--radius-button);
          font-family: var(--font-body);
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 0.01em;
          padding: 12px 24px;
          cursor: pointer;
          transition: background-color var(--motion-hover-duration) var(--motion-hover-easing);
        }

        .onboarding-placeholder__skip:hover {
          background-color: var(--color-bg-elevated);
        }
      `}</style>
    </section>
  );
}
