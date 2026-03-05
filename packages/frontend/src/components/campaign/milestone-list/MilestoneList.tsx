import type { ReactElement } from 'react';
import { formatBasisPoints, type Milestone } from '../../../types/campaign';

interface MilestoneListProps {
  readonly milestones: Milestone[];
}

/**
 * MilestoneList — read-only display of campaign milestones.
 * Converts fundingBasisPoints to percentage display via formatBasisPoints.
 */
export function MilestoneList({ milestones }: MilestoneListProps): ReactElement {
  if (milestones.length === 0) {
    return (
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '14px',
          color: 'var(--color-text-tertiary)',
          margin: 0,
        }}
      >
        No milestones defined.
      </p>
    );
  }

  return (
    <ol
      aria-label="Campaign milestones"
      style={{
        listStyle: 'none',
        padding: 0,
        margin: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      {milestones.map((milestone, index) => (
        <li
          key={index}
          style={{
            background: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 'var(--radius-card)',
            padding: '14px 16px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: '6px',
              gap: '8px',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '14px',
                fontWeight: 600,
                color: 'var(--color-text-primary)',
                flex: 1,
              }}
            >
              {index + 1}. {milestone.title}
            </span>
            <span
              aria-label={`Funding allocation: ${formatBasisPoints(milestone.fundingBasisPoints)}`}
              style={{
                fontFamily: 'var(--font-data)',
                fontSize: '13px',
                color: 'var(--color-action-primary)',
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {formatBasisPoints(milestone.fundingBasisPoints)}
            </span>
          </div>
          {milestone.description && (
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '13px',
                color: 'var(--color-text-secondary)',
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              {milestone.description}
            </p>
          )}
          {milestone.targetDate && (
            <p
              style={{
                fontFamily: 'var(--font-data)',
                fontSize: '11px',
                color: 'var(--color-text-tertiary)',
                margin: '6px 0 0',
              }}
            >
              Target:{' '}
              {new Intl.DateTimeFormat('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              }).format(new Date(milestone.targetDate))}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}
