import { SignUp } from '@clerk/clerk-react';
import type { ReactElement } from 'react';

const CLERK_APPEARANCE = {
  variables: {
    colorBackground: '#0B1628',
    colorInputBackground: 'rgba(245,248,255,0.04)',
    colorInputText: '#E8EDF5',
    colorText: '#E8EDF5',
    colorTextSecondary: '#C8D0DC',
    colorPrimary: '#FF5C1A',
    borderRadius: '12px',
    fontFamily: 'DM Sans, sans-serif',
  },
};

/**
 * SignUpPage — /sign-up
 * Wraps Clerk's SignUp component with MMF branding.
 */
export default function SignUpPage(): ReactElement {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--color-bg-page)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
      }}
    >
      {/* MMF Logo placeholder */}
      <div
        style={{
          marginBottom: '48px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <div
          style={{
            width: '120px',
            height: '120px',
            borderRadius: '50%',
            background: 'var(--gradient-action-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          aria-label="Mars Mission Fund logo"
          role="img"
        >
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '48px',
              color: 'var(--color-action-primary-text)',
              letterSpacing: '0.04em',
            }}
          >
            MMF
          </span>
        </div>
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '24px',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--color-text-primary)',
          }}
        >
          MARS MISSION FUND
        </span>
      </div>

      <div style={{ maxWidth: '480px', width: '100%' }}>
        <SignUp
          routing="path"
          path="/sign-up"
          afterSignUpUrl="/auth/callback"
          appearance={CLERK_APPEARANCE}
        />
      </div>
    </div>
  );
}
