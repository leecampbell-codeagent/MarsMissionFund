import { type ChangeEvent, type ReactElement, useState } from 'react';
import type { Campaign } from '../../../types/campaign';

interface FundingSectionProps {
  readonly campaign: Campaign;
  readonly onChange: (field: string, value: string | null) => void;
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
  fontSize: '13px',
  fontWeight: 600,
  color: 'var(--color-text-secondary)',
  marginBottom: '6px',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

/**
 * Converts cents string to dollar display string for input.
 */
function centsToDollarInput(cents: string | null): string {
  if (!cents) return '';
  const dollarAmount = Number(cents) / 100;
  return String(dollarAmount);
}

/**
 * Converts dollar input string to cents string for API.
 * Returns null for empty/invalid input.
 */
function dollarInputToCents(dollars: string): string | null {
  const trimmed = dollars.trim();
  if (!trimmed) return null;
  const numericValue = parseFloat(trimmed);
  if (Number.isNaN(numericValue) || numericValue <= 0) return null;
  return String(Math.round(numericValue * 100));
}

function formatPreview(dollars: string): string {
  const num = parseFloat(dollars);
  if (Number.isNaN(num)) return '';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
}

/**
 * FundingSection — Funding goal (USD), funding cap, deadline.
 * User inputs in dollars; frontend converts to cents for API.
 */
export function FundingSection({ campaign, onChange }: FundingSectionProps): ReactElement {
  const [goalInput, setGoalInput] = useState(centsToDollarInput(campaign.fundingGoalCents));
  const [capInput, setCapInput] = useState(centsToDollarInput(campaign.fundingCapCents));

  const goalNum = parseFloat(goalInput);
  const isGoalBelowMin = !Number.isNaN(goalNum) && goalNum < 1_000_000;

  const handleGoalBlur = () => {
    const cents = dollarInputToCents(goalInput);
    onChange('fundingGoalCents', cents);
  };

  const handleCapBlur = () => {
    const cents = dollarInputToCents(capInput);
    onChange('fundingCapCents', cents);
  };

  return (
    <section aria-label="Funding" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <h2
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '24px',
          color: 'var(--color-text-primary)',
          textTransform: 'uppercase',
          margin: 0,
        }}
      >
        Funding
      </h2>

      {/* Funding goal */}
      <div>
        <label htmlFor="campaign-funding-goal" style={labelStyle}>
          Funding Goal (USD){' '}
          <span aria-hidden="true" style={{ color: 'var(--color-status-error)' }}>
            *
          </span>
        </label>
        <div style={{ position: 'relative' }}>
          <span
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              fontFamily: 'var(--font-data)',
              color: 'var(--color-text-tertiary)',
              pointerEvents: 'none',
            }}
          >
            $
          </span>
          <input
            id="campaign-funding-goal"
            type="number"
            min="1000000"
            step="1000"
            value={goalInput}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setGoalInput(e.target.value)}
            onBlur={handleGoalBlur}
            placeholder="1000000"
            style={{ ...inputStyle, paddingLeft: '24px' }}
            aria-required="true"
          />
        </div>
        {isGoalBelowMin && (
          <p
            role="alert"
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '12px',
              color: 'var(--color-status-error)',
              marginTop: '4px',
            }}
          >
            Minimum funding goal is $1,000,000
          </p>
        )}
        {goalInput && !Number.isNaN(goalNum) && (
          <p
            style={{
              fontFamily: 'var(--font-data)',
              fontSize: '11px',
              color: 'var(--color-text-tertiary)',
              marginTop: '4px',
            }}
          >
            {formatPreview(goalInput)}
          </p>
        )}
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '11px',
            color: 'var(--color-text-tertiary)',
            marginTop: '2px',
          }}
        >
          Minimum: $1,000,000
        </p>
      </div>

      {/* Funding cap */}
      <div>
        <label htmlFor="campaign-funding-cap" style={labelStyle}>
          Funding Cap (USD)
        </label>
        <div style={{ position: 'relative' }}>
          <span
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              fontFamily: 'var(--font-data)',
              color: 'var(--color-text-tertiary)',
              pointerEvents: 'none',
            }}
          >
            $
          </span>
          <input
            id="campaign-funding-cap"
            type="number"
            min="0"
            step="1000"
            value={capInput}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setCapInput(e.target.value)}
            onBlur={handleCapBlur}
            placeholder="Optional — maximum funding to accept"
            style={{ ...inputStyle, paddingLeft: '24px' }}
          />
        </div>
        {capInput && !Number.isNaN(parseFloat(capInput)) && (
          <p
            style={{
              fontFamily: 'var(--font-data)',
              fontSize: '11px',
              color: 'var(--color-text-tertiary)',
              marginTop: '4px',
            }}
          >
            {formatPreview(capInput)}
          </p>
        )}
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '11px',
            color: 'var(--color-text-tertiary)',
            marginTop: '2px',
          }}
        >
          Optional. Must be greater than or equal to funding goal.
        </p>
      </div>

      {/* Deadline */}
      <div>
        <label htmlFor="campaign-deadline" style={labelStyle}>
          Funding Deadline{' '}
          <span aria-hidden="true" style={{ color: 'var(--color-status-error)' }}>
            *
          </span>
        </label>
        <input
          id="campaign-deadline"
          type="date"
          value={campaign.deadline ? campaign.deadline.substring(0, 10) : ''}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            const val = e.target.value;
            onChange('deadline', val ? `${val}T00:00:00.000Z` : null);
          }}
          style={inputStyle}
          aria-required="true"
        />
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '11px',
            color: 'var(--color-text-tertiary)',
            marginTop: '4px',
          }}
        >
          Must be at least 7 days from submission, within 1 year.
        </p>
      </div>
    </section>
  );
}
