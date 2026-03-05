import { type ReactElement } from 'react';
import { formatCents, formatFundingPercentage } from '../../../types/campaign';

export interface FundingProgressBarProps {
  readonly fundingPercentage: number | null;
  readonly totalRaisedCents: string;
  readonly fundingGoalCents: string | null;
  readonly contributorCount: number;
}

/**
 * FundingProgressBar — displays funding progress for a public campaign.
 * Progress bar caps visually at 100% but text shows the actual percentage.
 * Uses Tier 2 semantic tokens only (--color-progress-*).
 */
export function FundingProgressBar({
  fundingPercentage,
  totalRaisedCents,
  fundingGoalCents,
  contributorCount,
}: FundingProgressBarProps): ReactElement {
  const clampedPercent = Math.min(fundingPercentage ?? 0, 100);
  const isFunded = (fundingPercentage ?? 0) >= 100;

  const progressFill = isFunded
    ? 'var(--color-progress-complete)'
    : 'var(--color-progress-fill)';

  return (
    <div>
      {/* Progress track */}
      <div
        role="progressbar"
        aria-valuenow={clampedPercent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Funding progress: ${formatFundingPercentage(fundingPercentage)}`}
        style={{
          height: '8px',
          borderRadius: '4px',
          background: 'var(--color-progress-track)',
          border: '1px solid var(--color-border-subtle)',
          overflow: 'hidden',
          marginBottom: '12px',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${clampedPercent}%`,
            background: progressFill,
            borderRadius: '4px',
            transition: 'width var(--motion-enter)',
          }}
        />
      </div>

      {/* Stats row */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
          justifyContent: 'space-between',
        }}
      >
        {/* Amount raised */}
        <div>
          <span
            style={{
              fontFamily: 'var(--font-data)',
              fontSize: '18px',
              fontWeight: 700,
              color: 'var(--color-text-primary)',
            }}
          >
            {formatCents(totalRaisedCents)}
          </span>
          {fundingGoalCents !== null && (
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '13px',
                color: 'var(--color-text-tertiary)',
                marginLeft: '6px',
              }}
            >
              of {formatCents(fundingGoalCents)} goal
            </span>
          )}
        </div>

        {/* Percentage */}
        <span
          style={{
            fontFamily: 'var(--font-data)',
            fontSize: '14px',
            color: isFunded
              ? 'var(--color-status-success)'
              : 'var(--color-text-accent)',
          }}
        >
          {formatFundingPercentage(fundingPercentage)}
        </span>
      </div>

      {/* Backers count */}
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '13px',
          color: 'var(--color-text-tertiary)',
          margin: '8px 0 0',
        }}
      >
        {contributorCount} {contributorCount === 1 ? 'backer' : 'backers'}
      </p>
    </div>
  );
}
