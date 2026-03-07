export default function HomePage() {
  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1.5rem',
        padding: '2rem',
        backgroundColor: 'var(--color-bg-page)',
      }}
    >
      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '96px',
          fontWeight: 400,
          letterSpacing: '0.03em',
          textTransform: 'uppercase',
          color: 'var(--color-text-primary)',
          textAlign: 'center',
          lineHeight: 1.1,
        }}
      >
        Mars Mission Fund
      </h1>

      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '16px',
          color: 'var(--color-text-secondary)',
          textAlign: 'center',
        }}
      >
        Platform launching soon
      </p>

      <output
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 12px',
          backgroundColor: 'var(--color-status-active-bg)',
          border: '1px solid var(--color-status-active-border)',
          borderRadius: 'var(--radius-badge)',
          fontFamily: 'var(--font-body)',
          fontSize: '12px',
          fontWeight: 600,
          color: 'var(--color-action-primary-hover)',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: 'var(--color-status-active)',
            flexShrink: 0,
          }}
        />
        Build OK
      </output>
    </main>
  );
}
