import { type ReactElement } from 'react';
import { type KycStatus } from '../../../api/kyc-api';
import { useKycSubmit } from '../../../hooks/account/use-kyc-submit';
import { KycStatusBadge } from '../kyc-status-badge';

interface KycVerificationPanelProps {
  readonly kycStatus?: KycStatus;
  readonly isLoading?: boolean;
  readonly error?: Error | null;
  readonly onRetry?: () => void;
}

const cardStyle: React.CSSProperties = {
  background: 'var(--color-bg-surface)',
  border: '1px solid var(--color-border-subtle)',
  borderRadius: 'var(--radius-card)',
  padding: '32px',
  position: 'relative',
  overflow: 'hidden',
};

const topAccentStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  height: '2px',
  background: 'linear-gradient(90deg, var(--color-border-accent), var(--color-status-warning))',
};

const bodyTextStyle: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontSize: '16px',
  fontWeight: 400,
  lineHeight: 1.7,
  color: 'var(--color-text-secondary)',
  margin: 0,
};

const primaryButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
  background: 'var(--gradient-action-primary)',
  color: 'var(--color-action-primary-text)',
  fontFamily: 'var(--font-body)',
  fontSize: '14px',
  fontWeight: 600,
  borderRadius: 'var(--radius-button)',
  padding: '12px 24px',
  border: 'none',
  cursor: 'pointer',
  boxShadow: '0 0 20px var(--color-action-primary-shadow)',
};

const primaryButtonDisabledStyle: React.CSSProperties = {
  ...primaryButtonStyle,
  opacity: 0.75,
  cursor: 'not-allowed',
};

function SpinnerIcon(): ReactElement {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      style={{ animation: 'kyc-spin 500ms linear infinite' }}
    >
      <style>{`
        @keyframes kyc-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .kyc-spinner { animation: none !important; }
        }
      `}</style>
      <circle
        cx="8"
        cy="8"
        r="6"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray="25 13"
        className="kyc-spinner"
      />
    </svg>
  );
}

interface CtaButtonProps {
  readonly label: string;
  readonly isLoading: boolean;
  readonly onClick: () => void;
}

function CtaButton({ label, isLoading, onClick }: CtaButtonProps): ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isLoading}
      aria-disabled={isLoading}
      aria-busy={isLoading}
      style={isLoading ? primaryButtonDisabledStyle : primaryButtonStyle}
    >
      {isLoading && <SpinnerIcon />}
      {isLoading ? 'Verifying\u2026' : label}
    </button>
  );
}

function LoadingSkeleton(): ReactElement {
  const skeletonStyle: React.CSSProperties = {
    background: 'var(--color-bg-elevated)',
    borderRadius: '4px',
    animation: 'kyc-skeleton-pulse 2s ease-in-out infinite',
  };

  return (
    <>
      <style>{`
        @keyframes kyc-skeleton-pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .kyc-skeleton { animation: none !important; opacity: 0.7; }
        }
      `}</style>
      <div
        style={cardStyle}
        aria-busy="true"
        aria-label="Loading identity verification status"
        className="kyc-skeleton"
      >
        <div style={topAccentStyle} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingTop: '8px' }}>
          {/* Badge placeholder */}
          <div
            style={{ ...skeletonStyle, width: '120px', height: '20px' }}
            className="kyc-skeleton"
          />
          {/* Heading placeholder */}
          <div
            style={{ ...skeletonStyle, width: '200px', height: '24px' }}
            className="kyc-skeleton"
          />
          {/* Body text placeholder — two lines */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div
              style={{ ...skeletonStyle, width: '100%', height: '16px' }}
              className="kyc-skeleton"
            />
            <div
              style={{ ...skeletonStyle, width: '80%', height: '16px' }}
              className="kyc-skeleton"
            />
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * KycVerificationPanel — full action panel for KYC verification status.
 * Renders status-appropriate content for all 6 KYC states plus loading/error states.
 * Composes KycStatusBadge and uses useKycSubmit internally for CTA handling.
 */
export function KycVerificationPanel({
  kycStatus,
  isLoading = false,
  error = null,
  onRetry,
}: KycVerificationPanelProps): ReactElement {
  const { submitKyc, isLoading: isSubmitting, isError: isSubmitError, error: submitError } = useKycSubmit();

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return (
      <div style={cardStyle}>
        <div style={topAccentStyle} />
        <div style={{ paddingTop: '8px' }}>
          <p
            role="alert"
            style={{
              ...bodyTextStyle,
              color: 'var(--color-text-error)',
              marginBottom: '16px',
            }}
          >
            Failed to load verification status. Please try again.
          </p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              style={primaryButtonStyle}
            >
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  const renderContent = (): ReactElement => {
    switch (kycStatus) {
      case 'not_started':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <h2
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '24px',
                fontWeight: 700,
                color: 'var(--color-text-primary)',
                margin: 0,
              }}
            >
              Verify Your Identity
            </h2>
            <p style={{ ...bodyTextStyle, marginBottom: '16px' }}>
              To submit campaigns and receive funds, you must complete identity verification.
            </p>
            {isSubmitError && submitError && (
              <div
                role="alert"
                aria-live="assertive"
                style={{
                  background: 'color-mix(in srgb, var(--color-status-error) 12%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--color-status-error) 20%, transparent)',
                  borderRadius: 'var(--radius-badge)',
                  padding: '12px 16px',
                  marginBottom: '12px',
                }}
              >
                <p
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '13px',
                    lineHeight: 1.7,
                    color: 'var(--color-text-error)',
                    margin: 0,
                  }}
                >
                  Verification could not be completed. {submitError.message}
                </p>
              </div>
            )}
            <div>
              <CtaButton
                label="Start Verification"
                isLoading={isSubmitting}
                onClick={() => { void submitKyc(); }}
              />
            </div>
          </div>
        );

      case 'pending':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <KycStatusBadge kycStatus="pending" />
            <p style={bodyTextStyle}>Your verification is being processed.</p>
          </div>
        );

      case 'in_review':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <KycStatusBadge kycStatus="in_review" />
            <p style={bodyTextStyle}>
              Your documents are under review. This may take up to 24 hours.
            </p>
          </div>
        );

      case 'verified':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <KycStatusBadge kycStatus="verified" />
            <p style={bodyTextStyle}>
              Your identity has been verified. You are eligible to submit campaigns.
            </p>
          </div>
        );

      case 'rejected':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <KycStatusBadge kycStatus="rejected" />
            <p style={{ ...bodyTextStyle, marginBottom: '8px' }}>
              Your verification was not successful. You may resubmit.
            </p>
            {isSubmitError && submitError && (
              <div
                role="alert"
                aria-live="assertive"
                style={{
                  background: 'color-mix(in srgb, var(--color-status-error) 12%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--color-status-error) 20%, transparent)',
                  borderRadius: 'var(--radius-badge)',
                  padding: '12px 16px',
                }}
              >
                <p
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '13px',
                    lineHeight: 1.7,
                    color: 'var(--color-text-error)',
                    margin: 0,
                  }}
                >
                  Verification could not be completed. {submitError.message}
                </p>
              </div>
            )}
            <div>
              <CtaButton
                label="Resubmit Verification"
                isLoading={isSubmitting}
                onClick={() => { void submitKyc(); }}
              />
            </div>
          </div>
        );

      case 'expired':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <KycStatusBadge kycStatus="expired" />
            <p style={bodyTextStyle}>Your verification has expired.</p>
          </div>
        );

      default:
        // kycStatus is undefined or unexpected — render a loading-like empty state
        return <LoadingSkeleton />;
    }
  };

  if (kycStatus === undefined) {
    return <LoadingSkeleton />;
  }

  return (
    <div style={cardStyle}>
      <div style={topAccentStyle} />
      <div style={{ paddingTop: '8px' }}>
        {renderContent()}
      </div>
    </div>
  );
}
