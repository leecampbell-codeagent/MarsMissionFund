interface AuthPageLayoutProps {
  readonly subtitle: string;
  readonly children: React.ReactNode;
}

export function AuthPageLayout({ subtitle, children }: AuthPageLayoutProps) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--gradient-hero)',
        padding: '0 24px',
      }}
    >
      <div
        style={{
          maxWidth: '480px',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {/* Logo block */}
        <div
          style={{
            textAlign: 'center',
            marginBottom: '32px',
          }}
        >
          <h1
            aria-label="Mars Mission Fund"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(40px, 8vw, 56px)',
              fontWeight: 400,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: 'var(--color-text-primary)',
              lineHeight: 1.1,
              margin: 0,
            }}
          >
            Mars Mission Fund
          </h1>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '16px',
              lineHeight: 1.7,
              color: 'var(--color-text-secondary)',
              marginTop: '8px',
              marginBottom: 0,
            }}
          >
            {subtitle}
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
