import { type ReactElement } from 'react';
import { type CampaignStatus } from '../../../types/campaign';

interface CampaignStatusBadgeProps {
  readonly status: CampaignStatus;
}

interface BadgeStyle {
  readonly background: string;
  readonly color: string;
  readonly border: string;
  readonly label: string;
}

const STATUS_STYLES: Record<CampaignStatus, BadgeStyle> = {
  draft: {
    background: 'var(--color-bg-elevated)',
    color: 'var(--color-text-tertiary)',
    border: '1px solid var(--color-border-subtle)',
    label: 'Draft',
  },
  submitted: {
    background: 'color-mix(in srgb, var(--color-status-warning) 15%, transparent)',
    color: 'var(--color-status-warning)',
    border: '1px solid color-mix(in srgb, var(--color-status-warning) 40%, transparent)',
    label: 'Submitted',
  },
  under_review: {
    background: 'color-mix(in srgb, var(--color-status-warning) 15%, transparent)',
    color: 'var(--color-status-warning)',
    border: '1px solid color-mix(in srgb, var(--color-status-warning) 40%, transparent)',
    label: 'Under Review',
  },
  approved: {
    background: 'color-mix(in srgb, var(--color-status-success) 15%, transparent)',
    color: 'var(--color-status-success)',
    border: '1px solid color-mix(in srgb, var(--color-status-success) 40%, transparent)',
    label: 'Approved',
  },
  rejected: {
    background: 'color-mix(in srgb, var(--color-status-error) 15%, transparent)',
    color: 'var(--color-status-error)',
    border: '1px solid color-mix(in srgb, var(--color-status-error) 40%, transparent)',
    label: 'Rejected',
  },
  live: {
    background: 'color-mix(in srgb, var(--color-status-success) 15%, transparent)',
    color: 'var(--color-status-success)',
    border: '1px solid color-mix(in srgb, var(--color-status-success) 40%, transparent)',
    label: 'Live',
  },
  archived: {
    background: 'var(--color-bg-elevated)',
    color: 'var(--color-text-tertiary)',
    border: '1px solid var(--color-border-subtle)',
    label: 'Archived',
  },
};

/**
 * CampaignStatusBadge — displays campaign status as a colour-coded badge.
 * Status → colour mapping per feat-003-spec-ui.md.
 */
export function CampaignStatusBadge({ status }: CampaignStatusBadgeProps): ReactElement {
  const styles = STATUS_STYLES[status];

  return (
    <span
      role="status"
      aria-label={`Campaign status: ${styles.label}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 10px',
        borderRadius: 'var(--radius-pill)',
        fontFamily: 'var(--font-body)',
        fontSize: '12px',
        fontWeight: 600,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        background: styles.background,
        color: styles.color,
        border: styles.border,
        userSelect: 'none',
      }}
    >
      {styles.label}
    </span>
  );
}
