import type { ChangeEvent, ReactElement } from 'react';
import { type Campaign, formatBasisPoints, type Milestone } from '../../../types/campaign';
import { Button } from '../../ui/Button';

interface MilestonesSectionProps {
  readonly campaign: Campaign;
  readonly onChange: (field: string, value: Milestone[]) => void;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--color-bg-elevated)',
  border: '1px solid var(--color-border-subtle)',
  borderRadius: 'var(--radius-input)',
  color: 'var(--color-text-primary)',
  fontFamily: 'var(--font-body)',
  fontSize: '14px',
  padding: '10px 14px',
  outline: 'none',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontFamily: 'var(--font-body)',
  fontSize: '12px',
  fontWeight: 600,
  color: 'var(--color-text-tertiary)',
  marginBottom: '4px',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const milestoneCardStyle: React.CSSProperties = {
  background: 'var(--color-bg-elevated)',
  border: '1px solid var(--color-border-subtle)',
  borderRadius: 'var(--radius-card)',
  padding: '16px',
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
};

/**
 * MilestonesSection — Milestone entries with basis points allocation.
 * Shows running total; warns when total != 10000.
 * At least 2 milestones required at submission; max 10.
 */
export function MilestonesSection({ campaign, onChange }: MilestonesSectionProps): ReactElement {
  const milestones = campaign.milestones;
  const totalBasisPoints = milestones.reduce((sum, m) => sum + (m.fundingBasisPoints || 0), 0);
  const isValid = totalBasisPoints === 10000;

  const addMilestone = () => {
    const newMilestone: Milestone = {
      id: crypto.randomUUID(),
      title: '',
      description: '',
      fundingBasisPoints: 0,
      targetDate: null,
    };
    onChange('milestones', [...milestones, newMilestone]);
  };

  const removeMilestone = (index: number) => {
    onChange(
      'milestones',
      milestones.filter((_, i) => i !== index),
    );
  };

  const updateMilestone = (
    index: number,
    field: keyof Milestone,
    value: string | number | null,
  ) => {
    const updated = milestones.map((m, i) =>
      i === index ? { ...m, [field]: value } : m,
    ) as Milestone[];
    onChange('milestones', updated);
  };

  return (
    <section
      aria-label="Milestones"
      style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
    >
      <h2
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '24px',
          color: 'var(--color-text-primary)',
          textTransform: 'uppercase',
          margin: 0,
        }}
      >
        Milestones
      </h2>

      {/* Basis points total indicator */}
      <div
        role="status"
        aria-label={`Milestone funding total: ${totalBasisPoints} of 10000 basis points`}
        style={{
          background: isValid
            ? 'color-mix(in srgb, var(--color-status-success) 10%, transparent)'
            : 'color-mix(in srgb, var(--color-status-warning) 10%, transparent)',
          border: `1px solid ${isValid ? 'color-mix(in srgb, var(--color-status-success) 30%, transparent)' : 'color-mix(in srgb, var(--color-status-warning) 30%, transparent)'}`,
          borderRadius: 'var(--radius-card)',
          padding: '12px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '13px',
            color: isValid ? 'var(--color-status-success)' : 'var(--color-status-warning)',
          }}
        >
          {isValid ? '✓ Funding allocation complete' : 'Funding allocation incomplete'}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-data)',
            fontSize: '13px',
            color: isValid ? 'var(--color-status-success)' : 'var(--color-status-warning)',
            fontWeight: 700,
          }}
        >
          Total: {totalBasisPoints} / 10,000 ({formatBasisPoints(totalBasisPoints)})
        </span>
      </div>

      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '13px',
          color: 'var(--color-text-secondary)',
          margin: 0,
        }}
      >
        At least 2 milestones required. Max 10. Allocations must sum to exactly 10,000 basis points
        (100%).
      </p>

      {milestones.length === 0 && (
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '14px',
            color: 'var(--color-text-tertiary)',
            textAlign: 'center',
            padding: '24px',
          }}
        >
          No milestones added yet.
        </p>
      )}

      {milestones.map((milestone, index) => (
        <div key={index} style={milestoneCardStyle} aria-label={`Milestone ${index + 1}`}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '13px',
                color: 'var(--color-text-secondary)',
                fontWeight: 600,
              }}
            >
              Milestone {index + 1}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => removeMilestone(index)}
              aria-label={`Remove milestone ${index + 1}`}
            >
              Remove
            </Button>
          </div>

          <div>
            <label htmlFor={`milestone-title-${index}`} style={labelStyle}>
              Title *
            </label>
            <input
              id={`milestone-title-${index}`}
              type="text"
              value={milestone.title}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                updateMilestone(index, 'title', e.target.value)
              }
              placeholder="e.g. Prototype Complete"
              required
              style={inputStyle}
            />
          </div>

          <div>
            <label htmlFor={`milestone-description-${index}`} style={labelStyle}>
              Description *
            </label>
            <textarea
              id={`milestone-description-${index}`}
              value={milestone.description}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                updateMilestone(index, 'description', e.target.value)
              }
              placeholder="What will be delivered at this milestone?"
              rows={2}
              required
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>

          <div>
            <label htmlFor={`milestone-bp-${index}`} style={labelStyle}>
              Funding Allocation (%) *
            </label>
            <input
              id={`milestone-bp-${index}`}
              type="number"
              min="0.01"
              max="100"
              step="0.01"
              value={
                milestone.fundingBasisPoints ? (milestone.fundingBasisPoints / 100).toFixed(2) : ''
              }
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                const pct = parseFloat(e.target.value);
                const bp = Number.isNaN(pct) ? 0 : Math.round(pct * 100);
                updateMilestone(index, 'fundingBasisPoints', bp);
              }}
              placeholder="e.g. 25.00"
              required
              style={inputStyle}
            />
            <p
              style={{
                fontFamily: 'var(--font-data)',
                fontSize: '11px',
                color: 'var(--color-text-tertiary)',
                marginTop: '4px',
              }}
            >
              = {milestone.fundingBasisPoints} basis points
            </p>
          </div>

          <div>
            <label htmlFor={`milestone-date-${index}`} style={labelStyle}>
              Target Date
            </label>
            <input
              id={`milestone-date-${index}`}
              type="date"
              value={milestone.targetDate ? milestone.targetDate.substring(0, 10) : ''}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                const val = e.target.value;
                updateMilestone(index, 'targetDate', val || null);
              }}
              style={inputStyle}
            />
          </div>
        </div>
      ))}

      {milestones.length < 10 && (
        <Button
          variant="secondary"
          size="sm"
          onClick={addMilestone}
          disabled={milestones.length >= 10}
        >
          + Add Milestone
        </Button>
      )}
    </section>
  );
}
