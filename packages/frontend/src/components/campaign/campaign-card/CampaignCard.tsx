import type { ReactElement } from 'react';
import {
  CAMPAIGN_CATEGORY_LABELS,
  type CampaignSummary,
  formatCents,
} from '../../../types/campaign';
import { CampaignStatusBadge } from '../campaign-status-badge/CampaignStatusBadge';

interface CampaignCardProps {
  readonly campaign: CampaignSummary;
  readonly onClick?: () => void;
}

function formatRelativeDate(isoString: string): string {
  const date = new Date(isoString);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

/**
 * CampaignCard — summary card for use in list views (my campaigns, review queue).
 * Uses --gradient-surface-card for card background per L2-001.
 */
export function CampaignCard({ campaign, onClick }: CampaignCardProps): ReactElement {
  const categoryLabel = campaign.category ? CAMPAIGN_CATEGORY_LABELS[campaign.category] : null;

  const displayDate = campaign.submittedAt ?? campaign.createdAt;
  const dateLabel = campaign.submittedAt ? 'Submitted' : 'Created';

  const cardStyle: React.CSSProperties = {
    background: 'var(--gradient-surface-card)',
    border: '1px solid var(--color-border-subtle)',
    borderRadius: 'var(--radius-card)',
    padding: '24px',
    cursor: onClick ? 'pointer' : 'default',
    transition: 'border-color var(--motion-hover), transform var(--motion-hover)',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    position: 'relative',
    overflow: 'hidden',
  };

  return (
    <article
      style={cardStyle}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      aria-label={`Campaign: ${campaign.title}`}
    >
      {/* Header row: badge + date */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <CampaignStatusBadge status={campaign.status} />
        <span
          style={{
            fontFamily: 'var(--font-data)',
            fontSize: '11px',
            color: 'var(--color-text-tertiary)',
          }}
        >
          {dateLabel} {formatRelativeDate(displayDate)}
        </span>
      </div>

      {/* Title */}
      <h3
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--type-card-title-size, 22px)',
          color: 'var(--color-text-primary)',
          margin: 0,
          textTransform: 'uppercase',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          lineHeight: 1.2,
        }}
      >
        {campaign.title}
      </h3>

      {/* Meta row: category + funding goal */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        {categoryLabel ? (
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '12px',
              color: 'var(--color-text-accent)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            {categoryLabel}
          </span>
        ) : (
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '12px',
              color: 'var(--color-text-tertiary)',
            }}
          >
            No category
          </span>
        )}

        {campaign.fundingGoalCents ? (
          <span
            style={{
              fontFamily: 'var(--font-data)',
              fontSize: '13px',
              color: 'var(--color-text-primary)',
              fontWeight: 600,
            }}
          >
            {formatCents(campaign.fundingGoalCents)}
          </span>
        ) : null}
      </div>
    </article>
  );
}
