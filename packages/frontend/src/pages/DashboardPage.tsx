export default function DashboardPage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-bg-page)',
      }}
    >
      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '56px',
          fontWeight: 400,
          letterSpacing: '0.04em',
          color: 'var(--color-text-primary)',
          textTransform: 'uppercase',
        }}
      >
        Dashboard
      </h1>
    </main>
  );
}
