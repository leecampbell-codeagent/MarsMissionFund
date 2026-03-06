import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LoadingSpinner } from '../components/ui/loading-spinner.js';
import { useKycStatus } from '../hooks/use-kyc-status.js';
import { useSubmitKyc } from '../hooks/use-submit-kyc.js';

type DocumentType = 'passport' | 'national_id' | 'drivers_licence';

export default function KycStubPage() {
  const { data: kycData, isLoading } = useKycStatus();
  const { mutate: submitKyc, isPending, isError, error } = useSubmitKyc();
  const [selectedDoc, setSelectedDoc] = useState<DocumentType>('passport');

  const status = kycData?.data.status;

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: 'calc(100vh - 64px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--color-bg-page)',
        }}
      >
        <LoadingSpinner label="Loading verification status" />
      </div>
    );
  }

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
            maxWidth: '480px',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: '32px',
          }}
        >
          {status === 'verified' ? (
            /* --- Verified / success state --- */
            <>
              {/* Section label for verified state */}
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
                01 — IDENTITY VERIFIED
              </p>
              <h1
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '48px',
                  fontWeight: 400,
                  letterSpacing: '0.04em',
                  color: 'var(--color-text-primary)',
                  lineHeight: 1,
                  textTransform: 'uppercase',
                  margin: 0,
                }}
              >
                VERIFICATION APPROVED
              </h1>
              {/* Checkmark icon - simple inline character, no undocumented container tokens */}
              <div
                style={{
                  fontSize: '32px',
                  color: 'var(--color-status-success)',
                  lineHeight: 1,
                }}
                aria-hidden="true"
              >
                ✓
              </div>
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '16px',
                  lineHeight: 1.7,
                  color: 'var(--color-text-secondary)',
                  margin: 0,
                }}
              >
                Your identity has been verified. You can now submit campaigns.
              </p>
              <Link
                to="/profile"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  alignSelf: 'flex-start',
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
                  textDecoration: 'none',
                  cursor: 'pointer',
                  transition: 'opacity var(--motion-hover)',
                }}
              >
                Return to Profile
              </Link>
            </>
          ) : (
            /* --- Form state (not_verified, pending, etc.) --- */
            <>
              {/* Section label for form state */}
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
                01 — VERIFY YOUR IDENTITY
              </p>

              {/* Page heading */}
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
                  lineHeight: 1.7,
                  color: 'var(--color-text-secondary)',
                  margin: 0,
                }}
              >
                To launch campaigns on Mars Mission Fund, we need to verify your identity. Select
                your document type below and submit — verification is processed automatically.
              </p>

              {/* Pending status banner */}
              {status === 'pending' && (
                <div
                  role="status"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '12px 16px',
                    backgroundColor: 'rgba(255, 183, 71, 0.1)',
                    border: '1px solid var(--color-status-warning)',
                    borderRadius: 'var(--radius-input)',
                  }}
                >
                  <LoadingSpinner size="sm" label="Pending" />
                  <span
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: '14px',
                      color: 'var(--color-status-warning)',
                    }}
                  >
                    Your verification is pending review.
                  </span>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label
                  htmlFor="document-type"
                  style={{
                    fontFamily: 'var(--font-data)',
                    fontSize: '11px',
                    letterSpacing: '0.2em',
                    textTransform: 'uppercase',
                    color: 'var(--color-text-tertiary)',
                  }}
                >
                  Document Type
                </label>
                <select
                  id="document-type"
                  value={selectedDoc}
                  onChange={(e) => setSelectedDoc(e.target.value as DocumentType)}
                  disabled={isPending}
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '16px',
                    color: 'var(--color-text-primary)',
                    backgroundColor: 'var(--color-bg-input)',
                    border: '1px solid var(--color-border-input)',
                    borderRadius: 'var(--radius-input)',
                    padding: '12px 16px',
                    width: '100%',
                    cursor: 'pointer',
                  }}
                >
                  <option value="passport">Passport</option>
                  <option value="national_id">National ID</option>
                  <option value="drivers_licence">Driver's Licence</option>
                </select>
              </div>

              {isError && (
                <p
                  role="alert"
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '14px',
                    color: 'var(--color-status-error)',
                    margin: 0,
                  }}
                >
                  {error instanceof Error
                    ? error.message
                    : 'Verification failed. Please try again.'}
                </p>
              )}

              <button
                type="button"
                onClick={() => submitKyc({ documentType: selectedDoc })}
                disabled={isPending}
                style={{
                  alignSelf: 'flex-start',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: '44px',
                  padding: '12px 32px',
                  fontFamily: 'var(--font-body)',
                  fontSize: '14px',
                  fontWeight: 600,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  color: 'var(--color-text-on-action)',
                  background: 'var(--gradient-action-primary)',
                  border: 'none',
                  borderRadius: 'var(--radius-button)',
                  cursor: isPending ? 'not-allowed' : 'pointer',
                  opacity: isPending ? 0.7 : 1,
                  boxShadow: '0 4px 16px var(--color-action-primary-shadow)',
                }}
              >
                {isPending ? (
                  <LoadingSpinner size="sm" label="Submitting" />
                ) : (
                  'SUBMIT FOR VERIFICATION'
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
