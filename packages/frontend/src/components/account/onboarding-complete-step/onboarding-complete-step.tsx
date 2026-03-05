import { type ReactElement, useEffect, useState } from 'react';

interface OnboardingCompleteStepProps {
  readonly displayName?: string | null;
}

/**
 * OnboardingCompleteStep — Step 5 of the onboarding flow.
 * Success confirmation with auto-redirect notice.
 * No CTA button — auto-redirects to / after 2 seconds.
 */
export function OnboardingCompleteStep({ displayName }: OnboardingCompleteStepProps): ReactElement {
  const [showRedirectNotice, setShowRedirectNotice] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowRedirectNotice(true);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  const heading = displayName
    ? `YOU'RE IN, ${displayName.toUpperCase()}.`
    : "YOU'RE IN.";

  return (
    <div
      aria-live="polite"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
      }}
    >
      {/* Success icon */}
      <div
        style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: 'var(--color-status-success-bg)',
          border: '1px solid var(--color-status-success-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'enterEmphasis var(--duration-medium) var(--easing-spring)',
        }}
      >
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          style={{ color: 'var(--color-status-success)' }}
        >
          <path
            d="M20 6L9 17L4 12"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '56px',
          fontWeight: 400,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: 'var(--color-text-primary)',
          marginTop: '24px',
          marginBottom: '16px',
          lineHeight: 1.1,
        }}
      >
        {heading}
      </h1>

      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '16px',
          lineHeight: 1.7,
          color: 'var(--color-text-secondary)',
          marginBottom: '32px',
          marginTop: 0,
          maxWidth: '480px',
        }}
      >
        Your mission profile is set. Explore live campaigns and back the missions that inspire you.
      </p>

      {showRedirectNotice && (
        <p
          role="status"
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '13px',
            color: 'var(--color-text-tertiary)',
            margin: 0,
          }}
        >
          Taking you to the platform…
        </p>
      )}
    </div>
  );
}




























