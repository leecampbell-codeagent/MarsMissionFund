import { useClerk, useUser } from '@clerk/react';
import { useNavigate } from 'react-router-dom';

export default function DashboardPage() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const navigate = useNavigate();

  const handleSignOut = () => {
    void signOut().then(() => {
      navigate('/sign-in');
    });
  };

  const email = user?.primaryEmailAddress?.emailAddress;

  return (
    <>
      <title>Dashboard — Mars Mission Fund</title>
      <div
        style={{
          minHeight: 'calc(100vh - 64px)',
          backgroundColor: 'var(--color-bg-page)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 24px',
        }}
      >
        <div
          style={{
            maxWidth: '640px',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
          }}
        >
          {/* Section label */}
          <p
            style={{
              fontFamily: 'var(--font-data)',
              fontSize: '11px',
              fontWeight: 400,
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              color: 'var(--color-text-accent)',
              margin: 0,
            }}
          >
            01 — MISSION CONTROL
          </p>

          {/* Page heading */}
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '56px',
              fontWeight: 400,
              letterSpacing: '0.04em',
              color: 'var(--color-text-primary)',
              lineHeight: 1,
              margin: 0,
              textTransform: 'uppercase',
            }}
          >
            DASHBOARD
          </h1>

          {/* Status message */}
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '16px',
              fontWeight: 400,
              lineHeight: 1.7,
              color: 'var(--color-text-secondary)',
              margin: 0,
            }}
          >
            Mission control is online. Your session is active.
          </p>

          {/* User identity line */}
          {email !== undefined && (
            <p style={{ margin: 0 }}>
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '13px',
                  fontWeight: 400,
                  lineHeight: 1.7,
                  color: 'var(--color-text-tertiary)',
                }}
              >
                Signed in as{' '}
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-data)',
                  fontSize: '14px',
                  fontWeight: 400,
                  color: 'var(--color-text-secondary)',
                }}
              >
                {email}
              </span>
            </p>
          )}

          {/* Coming soon card */}
          <section
            aria-label="Feature status"
            style={{
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 'var(--radius-card)',
              padding: '24px',
            }}
          >
            <p
              style={{
                fontFamily: 'var(--font-data)',
                fontSize: '11px',
                fontWeight: 400,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: 'var(--color-text-tertiary)',
                margin: '0 0 8px 0',
              }}
            >
              COMING SOON
            </p>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '13px',
                fontWeight: 400,
                lineHeight: 1.7,
                color: 'var(--color-text-tertiary)',
                margin: 0,
              }}
            >
              Campaign browsing, contribution flows, and your backer dashboard are in development.
            </p>
          </section>

          {/* Sign Out button */}
          <button
            type="button"
            onClick={handleSignOut}
            style={{
              alignSelf: 'flex-start',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '44px',
              padding: '12px 24px',
              fontFamily: 'var(--font-body)',
              fontSize: '14px',
              fontWeight: 600,
              letterSpacing: '0.01em',
              color: 'var(--color-action-ghost-text)',
              backgroundColor: 'transparent',
              border: '1px solid var(--color-action-ghost-border)',
              borderRadius: 'var(--radius-button)',
              cursor: 'pointer',
              transition: 'background-color var(--motion-hover), border-color var(--motion-hover)',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                'var(--color-action-secondary-bg)';
              (e.currentTarget as HTMLButtonElement).style.borderColor =
                'var(--color-action-ghost-text)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
              (e.currentTarget as HTMLButtonElement).style.borderColor =
                'var(--color-action-ghost-border)';
            }}
          >
            Sign Out
          </button>
        </div>
      </div>

      <style>{`
        @media (min-width: 768px) {
          /* Extra padding on tablet and up */
        }
        button:focus-visible {
          outline: 2px solid var(--color-action-primary-hover);
          outline-offset: 2px;
        }
      `}</style>
    </>
  );
}
