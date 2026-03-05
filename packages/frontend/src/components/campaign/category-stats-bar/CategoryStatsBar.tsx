import { type ReactElement } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCategoryStats } from '../../../api/public-campaign-api';
import {
  type CampaignCategory,
  CAMPAIGN_CATEGORY_LABELS,
  formatCents,
} from '../../../types/campaign';

export interface CategoryStatsBarProps {
  readonly category: string | null;
}

/**
 * CategoryStatsBar — displays aggregate stats for a single selected category.
 * Only rendered when exactly one category is selected.
 * Shows skeleton loading state while data is fetching.
 */
export function CategoryStatsBar({ category }: CategoryStatsBarProps): ReactElement | null {
  const { data, isLoading } = useQuery({
    queryKey: ['categoryStats', category],
    queryFn: () => getCategoryStats(category!),
    enabled: !!category,
    staleTime: 30_000,
  });

  if (!category) return null;

  const categoryLabel =
    category in CAMPAIGN_CATEGORY_LABELS
      ? CAMPAIGN_CATEGORY_LABELS[category as CampaignCategory]
      : category;

  if (isLoading) {
    return (
      <div
        role="status"
        aria-label="Loading category statistics"
        style={{
          background: 'var(--color-bg-elevated)',
          border: '1px solid var(--color-border-subtle)',
          borderRadius: 'var(--radius-card)',
          padding: '16px 20px',
          display: 'flex',
          gap: '24px',
          flexWrap: 'wrap',
        }}
      >
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              width: '80px',
              height: '36px',
              background: 'var(--color-bg-surface)',
              borderRadius: 'var(--radius-input)',
              opacity: 0.6,
            }}
          />
        ))}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div
      style={{
        background: 'var(--gradient-surface-stat, var(--color-bg-elevated))',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 'var(--radius-card)',
        padding: '16px 20px',
        display: 'flex',
        gap: '24px',
        flexWrap: 'wrap',
        alignItems: 'center',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '13px',
          fontWeight: 600,
          color: 'var(--color-text-accent)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        {categoryLabel}
      </span>

      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
        <div>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--color-text-tertiary)',
              margin: '0 0 2px',
            }}
          >
            Total Campaigns
          </p>
          <p
            style={{
              fontFamily: 'var(--font-data)',
              fontSize: '20px',
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              margin: 0,
            }}
          >
            {data.campaignCount}
          </p>
        </div>

        <div>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--color-text-tertiary)',
              margin: '0 0 2px',
            }}
          >
            Active
          </p>
          <p
            style={{
              fontFamily: 'var(--font-data)',
              fontSize: '20px',
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              margin: 0,
            }}
          >
            {data.activeCampaignCount}
          </p>
        </div>

        <div>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--color-text-tertiary)',
              margin: '0 0 2px',
            }}
          >
            Total Raised
          </p>
          <p
            style={{
              fontFamily: 'var(--font-data)',
              fontSize: '20px',
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              margin: 0,
            }}
          >
            {formatCents(data.totalRaisedCents)}
          </p>
        </div>
      </div>
    </div>
  );
}
