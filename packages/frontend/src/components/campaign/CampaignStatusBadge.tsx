import type { ReactElement } from 'react';
import type { CampaignStatus } from '../../api/campaign-api';

const STATUS_LABELS: Readonly<Record<string, string>> = {
  draft: 'DRAFT',
  submitted: 'SUBMITTED',
  under_review: 'UNDER REVIEW',
  approved: 'APPROVED',
  rejected: 'REJECTED',
  live: 'LIVE',
  funded: 'FUNDED',
  suspended: 'SUSPENDED',
  failed: 'FAILED',
  settlement: 'SETTLEMENT',
  complete: 'COMPLETE',
  cancelled: 'CANCELLED',
};

interface CampaignStatusBadgeProps {
  readonly status: CampaignStatus | string;
}

export function CampaignStatusBadge({ status }: CampaignStatusBadgeProps): ReactElement {
  const label = STATUS_LABELS[status] ?? status.toUpperCase();

  return (
    <>
      <span className={`campaign-status-badge campaign-status-badge--${status}`} aria-label={`Status: ${label}`}>
        {label}
      </span>
      <style>{`
        .campaign-status-badge {
          display: inline-block;
          font-family: var(--font-data);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.3em;
          text-transform: uppercase;
          padding: 4px 10px;
          border-radius: 100px;
          border: 1px solid currentColor;
        }

        .campaign-status-badge--draft {
          color: var(--color-text-tertiary);
          background: rgba(255, 255, 255, 0.04);
        }

        .campaign-status-badge--submitted {
          color: var(--color-status-warning);
          background: rgba(255, 171, 0, 0.08);
        }

        .campaign-status-badge--approved,
        .campaign-status-badge--live,
        .campaign-status-badge--funded,
        .campaign-status-badge--complete {
          color: var(--color-status-success);
          background: rgba(0, 200, 80, 0.08);
        }

        .campaign-status-badge--rejected,
        .campaign-status-badge--failed,
        .campaign-status-badge--cancelled,
        .campaign-status-badge--suspended {
          color: var(--color-status-error);
          background: rgba(193, 68, 14, 0.08);
        }

        .campaign-status-badge--under_review,
        .campaign-status-badge--settlement {
          color: var(--color-text-accent);
          background: rgba(255, 92, 26, 0.08);
        }
      `}</style>
    </>
  );
}
