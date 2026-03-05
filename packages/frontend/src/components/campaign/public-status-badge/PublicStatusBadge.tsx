import type { ReactElement } from 'react';

export interface PublicStatusBadgeProps {
  readonly status: 'live' | 'funded';
  readonly daysRemaining?: number | null;
}

/**
 * PublicStatusBadge — displays public campaign status as a colour-coded badge.
 * For public discovery pages (live/funded campaigns only).
 * - 'funded' → "Fully Funded" in success colour
 * - 'live' with daysRemaining <= 7 → "Ending Soon" in warning colour
 * - 'live' otherwise → "Live" in info colour
 */
export function PublicStatusBadge({ status, daysRemaining }: PublicStatusBadgeProps): ReactElement {
  if (status === 'funded') {
    return (
      <span
        role="status"
        aria-label="Campaign status: Fully Funded"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '2px 10px',
          borderRadius: 'var(--radius-pill, var(--radius-badge))',
          fontFamily: 'var(--font-body)',
          fontSize: '12px',
          fontWeight: 600,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          background: 'var(--color-status-success-bg)',
          color: 'var(--color-status-success)',
          border: '1px solid var(--color-status-success-border)',
          userSelect: 'none',
        }}
      >
        Fully Funded
      </span>
    );
  }

  const isEndingSoon = daysRemaining !== null && daysRemaining !== undefined && daysRemaining <= 7;

  if (isEndingSoon) {
    return (
      <span
        role="status"
        aria-label="Campaign status: Ending Soon"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '2px 10px',
          borderRadius: 'var(--radius-pill, var(--radius-badge))',
          fontFamily: 'var(--font-body)',
          fontSize: '12px',
          fontWeight: 600,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          background: 'color-mix(in srgb, var(--color-status-warning) 15%, transparent)',
          color: 'var(--color-status-warning)',
          border: '1px solid color-mix(in srgb, var(--color-status-warning) 40%, transparent)',
          userSelect: 'none',
        }}
      >
        Ending Soon
      </span>
    );
  }

  return (
    <span
      role="status"
      aria-label="Campaign status: Live"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 10px',
        borderRadius: 'var(--radius-pill, var(--radius-badge))',
        fontFamily: 'var(--font-body)',
        fontSize: '12px',
        fontWeight: 600,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        background: 'var(--color-status-active-bg)',
        color: 'var(--color-status-active)',
        border: '1px solid var(--color-status-active-border)',
        userSelect: 'none',
      }}
    >
      Live
    </span>
  );
}
