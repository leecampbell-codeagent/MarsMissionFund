import { SignIn } from '@clerk/clerk-react';
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
 * SignInPage — /sign-in
 * Wraps Clerk's SignIn component with MMF branding.
 */
export default function SignInPage(): ReactElement {
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
      {/* MMF Logo placeholder — full vertical lockup */}
      <div
        style={{
          marginBottom: '48px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        {/* Coin icon mark placeholder */}
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
        <SignIn
          routing="path"
          path="/sign-in"
          afterSignInUrl="/auth/callback"
          appearance={CLERK_APPEARANCE}
        />
      </div>
    </div>
  );
}
