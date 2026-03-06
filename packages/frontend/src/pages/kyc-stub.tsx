import { useNavigate } from 'react-router-dom';

export default function KycStubPage() {
  const navigate = useNavigate();

  const handleBack = () => {
    navigate(-1);
  };

  return (
    <>
      <title>Identity Verification — Mars Mission Fund</title>
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
            maxWidth: '560px',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
          }}
        >
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
            KYC — VERIFICATION
          </p>

          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '48px',
              fontWeight: 400,
              letterSpacing: '0.04em',
              color: 'var(--color-text-primary)',
              lineHeight: 1,
              margin: 0,
              textTransform: 'uppercase',
            }}
          >
            IDENTITY VERIFICATION
          </h1>

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
            KYC verification is not yet available. Your Creator role request has been noted.
          </p>

          <button
            type="button"
            onClick={handleBack}
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
            }}
          >
            Go Back
          </button>
        </div>
      </div>
    </>
  );
}
