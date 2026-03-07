export function AuthLoadingScreen() {
  return (
    <>
      <style>{`
        @keyframes mmf-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }

        .auth-loading-icon {
          animation: mmf-pulse 1.5s ease-in-out infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .auth-loading-icon {
            animation: none;
            opacity: 0.7;
          }
        }
      `}</style>
      <output
        aria-busy="true"
        aria-label="Loading Mars Mission Fund"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          background: 'var(--color-bg-page)',
        }}
      >
        <div
          className="auth-loading-icon"
          aria-hidden="true"
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: 'var(--gradient-action-primary)',
          }}
        />
      </output>
    </>
  );
}
