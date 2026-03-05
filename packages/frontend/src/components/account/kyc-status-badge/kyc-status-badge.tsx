import type { ReactElement } from 'react';
import type { KycStatus } from '../../../api/kyc-api';

interface KycStatusBadgeProps {
  readonly kycStatus: KycStatus;
}

interface BadgeConfig {
  readonly label: string;
  readonly dotColor: string;
  readonly textColor: string;
  readonly background: string;
  readonly border: string;
  readonly isPulsing: boolean;
}

function getBadgeConfig(kycStatus: KycStatus): BadgeConfig {
  switch (kycStatus) {
    case 'not_started':
      return {
        label: 'IDENTITY VERIFICATION REQUIRED',
        dotColor: 'var(--color-status-warning)',
        textColor: 'var(--color-text-warning)',
        background: 'color-mix(in srgb, var(--color-status-warning) 10%, transparent)',
        border: '1px solid color-mix(in srgb, var(--color-status-warning) 25%, transparent)',
        isPulsing: false,
      };
    case 'pending':
      return {
        label: 'VERIFICATION IN PROGRESS',
        dotColor: 'var(--color-status-warning)',
        textColor: 'var(--color-text-warning)',
        background: 'color-mix(in srgb, var(--color-status-warning) 10%, transparent)',
        border: '1px solid color-mix(in srgb, var(--color-status-warning) 25%, transparent)',
        isPulsing: true,
      };
    case 'in_review':
      return {
        label: 'UNDER REVIEW',
        dotColor: 'var(--color-status-warning)',
        textColor: 'var(--color-text-warning)',
        background: 'color-mix(in srgb, var(--color-status-warning) 10%, transparent)',
        border: '1px solid color-mix(in srgb, var(--color-status-warning) 25%, transparent)',
        isPulsing: false,
      };
    case 'verified':
      return {
        label: 'IDENTITY VERIFIED',
        dotColor: 'var(--color-status-success)',
        textColor: 'var(--color-text-success)',
        background: 'var(--color-status-success-bg)',
        border: '1px solid var(--color-status-success-border)',
        isPulsing: false,
      };
    case 'rejected':
      return {
        label: 'VERIFICATION FAILED',
        dotColor: 'var(--color-status-error)',
        textColor: 'var(--color-text-error)',
        background: 'color-mix(in srgb, var(--color-status-error) 10%, transparent)',
        border: '1px solid color-mix(in srgb, var(--color-status-error) 25%, transparent)',
        isPulsing: false,
      };
    case 'expired':
      return {
        label: 'VERIFICATION EXPIRED',
        dotColor: 'var(--color-status-error)',
        textColor: 'var(--color-text-error)',
        background: 'color-mix(in srgb, var(--color-status-error) 10%, transparent)',
        border: '1px solid color-mix(in srgb, var(--color-status-error) 25%, transparent)',
        isPulsing: false,
      };
  }
}

/**
 * KycStatusBadge — compact inline badge for displaying KYC verification status.
 * Supports all 6 KYC states with appropriate colour coding and accessibility.
 */
export function KycStatusBadge({ kycStatus }: KycStatusBadgeProps): ReactElement {
  const config = getBadgeConfig(kycStatus);

  const badgeStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    borderRadius: 'var(--radius-badge)',
    padding: '6px 12px',
    background: config.background,
    border: config.border,
    fontFamily: 'var(--font-data)',
    fontSize: '11px',
    fontWeight: 400,
    letterSpacing: '0.2em',
    textTransform: 'uppercase',
    color: config.textColor,
  };

  const dotStyle: React.CSSProperties = {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: config.dotColor,
    flexShrink: 0,
    ...(config.isPulsing
      ? {
          animation: 'kyc-pulse 1.5s ease-in-out infinite',
        }
      : {}),
  };

  return (
    <>
      {config.isPulsing && (
        <style>{`
          @keyframes kyc-pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
          }
          @media (prefers-reduced-motion: reduce) {
            .kyc-dot-pulse {
              animation: none !important;
              opacity: 0.7;
            }
          }
        `}</style>
      )}
      <span role="status" style={badgeStyle}>
        <span
          aria-hidden="true"
          style={dotStyle}
          className={config.isPulsing ? 'kyc-dot-pulse' : undefined}
        />
        {config.label}
      </span>
    </>
  );
}
