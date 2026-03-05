import { type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import {
  type PublicCampaignListItem,
  CAMPAIGN_CATEGORY_LABELS,
  type CampaignCategory,
  formatCents,
  formatFundingPercentage,
} from '../../../types/campaign';
import { PublicStatusBadge } from '../public-status-badge/PublicStatusBadge';

export interface PublicCampaignCardProps {
  readonly campaign: PublicCampaignListItem;
}

function getDaysRemainingText(daysRemaining: number | null, status: 'live' | 'funded'): string | null {
  if (status === 'funded') return null;
  if (daysRemaining === null) return null;
  if (daysRemaining === 0) return 'Last day!';
  return `${daysRemaining} days left`;
}

/**
 * PublicCampaignCard — card for public campaign discovery.
 * Entire card links to /campaigns/:id.
 * Uses --gradient-surface-card background per L2-001.
 */
export function PublicCampaignCard({ campaign }: PublicCampaignCardProps): ReactElement {
  const categoryLabel =
    campaign.category && campaign.category in CAMPAIGN_CATEGORY_LABELS
      ? CAMPAIGN_CATEGORY_LABELS[campaign.category as CampaignCategory]
      : campaign.category;

  const clampedPercent = Math.min(campaign.fundingPercentage ?? 0, 100);
  const isFunded = (campaign.fundingPercentage ?? 0) >= 100 || campaign.status === 'funded';
  const progressFill = isFunded
    ? 'var(--color-progress-complete)'
    : 'var(--color-progress-fill)';

  const daysText = getDaysRemainingText(campaign.daysRemaining, campaign.status);
  const creatorDisplay = campaign.creatorName ?? 'Creator';

  return (
    <article
      style={{
        background: 'var(--gradient-surface-card)',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 'var(--radius-card)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        transition: 'border-color var(--motion-hover), transform var(--motion-hover)',
      }}
      aria-label={`Campaign: ${campaign.title}`}
    >
      <Link
        to={`/campaigns/${campaign.id}`}
        style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', flex: 1 }}
        aria-label={`View campaign: ${campaign.title}`}
      >
        {/* Hero image */}
        <div
          style={{
            height: '160px',
            overflow: 'hidden',
            flexShrink: 0,
            background: campaign.heroImageUrl ? undefined : 'var(--gradient-surface-card)',
            borderBottom: '1px solid var(--color-border-subtle)',
          }}
        >
          {campaign.heroImageUrl ? (
            <img
              src={campaign.heroImageUrl}
              alt={`Hero image for ${campaign.title}`}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div
              aria-hidden="true"
              style={{
                width: '100%',
                height: '100%',
                background: 'var(--gradient-campaign-hero)',
                opacity: 0.6,
              }}
            />
          )}
        </div>

        {/* Card body */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
          {/* Badges row */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <PublicStatusBadge status={campaign.status} daysRemaining={campaign.daysRemaining} />
            {categoryLabel && (
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
            )}
          </div>

          {/* Title */}
          <h3
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '22px',
              textTransform: 'uppercase',
              color: 'var(--color-text-primary)',
              margin: 0,
              lineHeight: 1.2,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {campaign.title}
          </h3>

          {/* Short description */}
          {campaign.shortDescription && (
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '13px',
                color: 'var(--color-text-secondary)',
                margin: 0,
                lineHeight: 1.5,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {campaign.shortDescription}
            </p>
          )}

          {/* Progress bar */}
          <div>
            <div
              role="progressbar"
              aria-valuenow={clampedPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Funding progress: ${formatFundingPercentage(campaign.fundingPercentage)}`}
              style={{
                height: '8px',
                borderRadius: '4px',
                background: 'var(--color-progress-track)',
                border: '1px solid var(--color-border-subtle)',
                overflow: 'hidden',
                marginBottom: '8px',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${clampedPercent}%`,
                  background: progressFill,
                  borderRadius: '4px',
                }}
              />
            </div>

            {/* Funding amounts */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-data)',
                  fontSize: '13px',
                  color: 'var(--color-text-primary)',
                  fontWeight: 600,
                }}
              >
                {formatCents(campaign.totalRaisedCents)} raised
              </span>
              {campaign.fundingGoalCents !== null && (
                <span
                  style={{
                    fontFamily: 'var(--font-data)',
                    fontSize: '12px',
                    color: 'var(--color-text-tertiary)',
                  }}
                >
                  of {formatCents(campaign.fundingGoalCents)}
                </span>
              )}
            </div>
          </div>

          {/* Footer: days remaining + creator */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 'auto',
              paddingTop: '4px',
            }}
          >
            {daysText !== null ? (
              <span
                style={{
                  fontFamily: 'var(--font-data)',
                  fontSize: '12px',
                  color:
                    campaign.daysRemaining === 0
                      ? 'var(--color-status-warning)'
                      : 'var(--color-text-tertiary)',
                }}
              >
                {daysText}
              </span>
            ) : (
              <span
                style={{
                  fontFamily: 'var(--font-data)',
                  fontSize: '12px',
                  color: 'var(--color-text-tertiary)',
                }}
              >
                {campaign.status === 'funded' ? 'Funded' : 'No deadline'}
              </span>
            )}

            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '12px',
                color: 'var(--color-text-tertiary)',
              }}
            >
              by {creatorDisplay}
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}
