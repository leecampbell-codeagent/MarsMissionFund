import { useAuth, useClerk, useUser } from '@clerk/react';
import { Link, useNavigate } from 'react-router-dom';

export function Header() {
  const { isLoaded, isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const { user } = useUser();
  const navigate = useNavigate();

  const handleSignOut = () => {
    void signOut().then(() => {
      navigate('/sign-in');
    });
  };

  return (
    <header
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '64px',
        backgroundColor: 'var(--color-bg-surface)',
        borderBottom: '1px solid var(--color-border-subtle)',
        backdropFilter: 'blur(8px)',
        zIndex: 50,
        padding: '0 24px',
      }}
    >
      <div
        style={{
          maxWidth: '1280px',
          margin: '0 auto',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Logo / wordmark */}
        <Link
          to="/"
          aria-label="Mars Mission Fund — home"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            textDecoration: 'none',
            padding: '8px',
          }}
        >
          {/* Coin icon placeholder — 32px height, decorative */}
          <svg
            aria-hidden="true"
            width="32"
            height="32"
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle
              cx="16"
              cy="16"
              r="14"
              stroke="var(--color-action-primary)"
              strokeWidth="2"
              fill="var(--color-bg-elevated)"
            />
            <text
              x="16"
              y="21"
              textAnchor="middle"
              fontSize="14"
              fontFamily="var(--font-display)"
              fill="var(--color-action-primary)"
            >
              M
            </text>
          </svg>
          <span
            className="wordmark"
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '14px',
              fontWeight: 600,
              letterSpacing: '0.01em',
              color: 'var(--color-text-primary)',
            }}
          >
            Mars Mission Fund
          </span>
        </Link>

        {/* Auth controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {isLoaded && !isSignedIn && (
            <Link
              to="/sign-in"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '44px',
                padding: '10px 20px',
                fontFamily: 'var(--font-body)',
                fontSize: '14px',
                fontWeight: 600,
                letterSpacing: '0.01em',
                color: 'var(--color-action-ghost-text)',
                backgroundColor: 'transparent',
                border: '1px solid var(--color-action-ghost-border)',
                borderRadius: 'var(--radius-button)',
                textDecoration: 'none',
                transition:
                  'background-color var(--motion-hover), border-color var(--motion-hover)',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.backgroundColor =
                  'var(--color-action-secondary-bg)';
                (e.currentTarget as HTMLAnchorElement).style.borderColor =
                  'var(--color-action-ghost-text)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.backgroundColor = 'transparent';
                (e.currentTarget as HTMLAnchorElement).style.borderColor =
                  'var(--color-action-ghost-border)';
              }}
            >
              Sign In
            </Link>
          )}

          {isLoaded && isSignedIn && (
            <>
              <span
                aria-hidden="true"
                className="user-email"
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '13px',
                  fontWeight: 400,
                  color: 'var(--color-text-tertiary)',
                }}
              >
                {user?.primaryEmailAddress?.emailAddress}
              </span>
              <button
                type="button"
                onClick={handleSignOut}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: '44px',
                  padding: '10px 20px',
                  fontFamily: 'var(--font-body)',
                  fontSize: '14px',
                  fontWeight: 600,
                  letterSpacing: '0.01em',
                  color: 'var(--color-action-ghost-text)',
                  backgroundColor: 'transparent',
                  border: '1px solid var(--color-action-ghost-border)',
                  borderRadius: 'var(--radius-button)',
                  cursor: 'pointer',
                  transition:
                    'background-color var(--motion-hover), border-color var(--motion-hover)',
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
            </>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 639px) {
          .wordmark { display: none; }
          .user-email { display: none; }
        }
        @media (min-width: 768px) {
          header { padding: 0 32px; }
        }
        @media (min-width: 1024px) {
          header { padding: 0 48px; }
        }
        header a:focus-visible,
        header button:focus-visible {
          outline: 2px solid var(--color-action-primary-hover);
          outline-offset: 2px;
        }
      `}</style>
    </header>
  );
}
