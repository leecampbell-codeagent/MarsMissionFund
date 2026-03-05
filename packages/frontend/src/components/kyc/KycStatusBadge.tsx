import type { ReactElement } from 'react';
import type { KycStatus } from '../../api/kyc-api';

interface KycStatusBadgeProps {
  readonly status: KycStatus;
}

interface StatusConfig {
  readonly label: string;
  readonly color: string;
  readonly bg: string;
  readonly border: string;
}

const STATUS_CONFIG: Readonly<Record<KycStatus, StatusConfig>> = {
  not_verified: {
    label: 'NOT VERIFIED',
    color: 'var(--color-text-tertiary)',
    bg: 'rgba(255, 255, 255, 0.05)',
    border: 'rgba(255, 255, 255, 0.1)',
  },
  pending: {
    label: 'PENDING',
    color: 'var(--color-text-warning)',
    bg: 'rgba(255, 170, 0, 0.1)',
    border: 'var(--color-status-warning)',
  },
  pending_resubmission: {
    label: 'RESUBMISSION REQUIRED',
    color: 'var(--color-text-warning)',
    bg: 'rgba(255, 170, 0, 0.1)',
    border: 'var(--color-status-warning)',
  },
  in_manual_review: {
    label: 'IN MANUAL REVIEW',
    color: 'var(--color-text-accent)',
    bg: 'rgba(255, 92, 26, 0.1)',
    border: 'var(--color-border-emphasis)',
  },
  verified: {
    label: 'VERIFIED',
    color: 'var(--color-text-success)',
    bg: 'var(--color-status-success-bg)',
    border: 'var(--color-status-success-border)',
  },
  rejected: {
    label: 'REJECTED',
    color: 'var(--color-text-error)',
    bg: 'rgba(193, 68, 14, 0.1)',
    border: 'var(--color-status-error)',
  },
  locked: {
    label: 'LOCKED',
    color: 'var(--color-text-error)',
    bg: 'rgba(193, 68, 14, 0.15)',
    border: 'var(--color-status-error)',
  },
  expired: {
    label: 'EXPIRED',
    color: 'var(--color-text-warning)',
    bg: 'rgba(255, 170, 0, 0.1)',
    border: 'var(--color-status-warning)',
  },
  reverification_required: {
    label: 'REVERIFICATION REQUIRED',
    color: 'var(--color-text-warning)',
    bg: 'rgba(255, 170, 0, 0.1)',
    border: 'var(--color-status-warning)',
  },
};

export function KycStatusBadge({ status }: KycStatusBadgeProps): ReactElement {
  const config = STATUS_CONFIG[status];

  return (
    <>
      <span
        className="kyc-status-badge"
        role="status"
        aria-label={`KYC status: ${config.label}`}
        style={{
          color: config.color,
          background: config.bg,
          borderColor: config.border,
        }}
      >
        {config.label}
      </span>
      <style>{`
        .kyc-status-badge {
          display: inline-block;
          font-family: var(--font-data);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          padding: 4px 12px;
          border-radius: 100px;
          border: 1px solid;
          line-height: 1.4;
        }
      `}</style>
    </>
  );
}
