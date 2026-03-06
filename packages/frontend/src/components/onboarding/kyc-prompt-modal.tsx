import { useNavigate } from 'react-router-dom';

interface KycPromptModalProps {
  readonly onClose: () => void;
}

export function KycPromptModal({ onClose }: KycPromptModalProps) {
  const navigate = useNavigate();

  const handleStartKyc = () => {
    void navigate('/kyc');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="kyc-modal-heading"
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--color-bg-overlay)',
        zIndex: 50,
        padding: '24px',
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border-subtle)',
          borderRadius: 'var(--radius-card-large)',
          padding: '32px',
          maxWidth: '480px',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <h2
          id="kyc-modal-heading"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '28px',
            fontWeight: 400,
            letterSpacing: '0.04em',
            color: 'var(--color-text-primary)',
            lineHeight: 1,
            margin: 0,
            textTransform: 'uppercase',
          }}
        >
          IDENTITY VERIFICATION REQUIRED
        </h2>

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
          Creator accounts require identity verification (KYC) before launching campaigns. You can
          complete this now or skip and verify later.
        </p>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            marginTop: '8px',
          }}
        >
          <button
            type="button"
            onClick={handleStartKyc}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '44px',
              padding: '12px 24px',
              fontFamily: 'var(--font-body)',
              fontSize: '14px',
              fontWeight: 600,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              color: 'var(--color-text-on-action)',
              background: 'var(--gradient-action-primary)',
              border: 'none',
              borderRadius: 'var(--radius-button)',
              cursor: 'pointer',
            }}
          >
            START KYC NOW
          </button>

          <button
            type="button"
            onClick={onClose}
            style={{
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
            SKIP FOR NOW
          </button>
        </div>
      </div>
    </div>
  );
}
