import { type ReactElement, type ChangeEvent } from 'react';
import {
  type Campaign,
  type CampaignCategory,
  CAMPAIGN_CATEGORY_LABELS,
} from '../../../types/campaign';

interface BasicsSectionProps {
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

const fieldGroupStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
};

/**
 * BasicsSection — Title, short description, category, alignment statement.
 */
export function BasicsSection({ campaign, onChange }: BasicsSectionProps): ReactElement {
  const shortDescLen = campaign.shortDescription?.length ?? 0;

  return (
    <section aria-label="Basics" style={fieldGroupStyle}>
      <h2
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '24px',
          color: 'var(--color-text-primary)',
          textTransform: 'uppercase',
          margin: 0,
        }}
      >
        Basics
      </h2>

      {/* Title */}
      <div>
        <label htmlFor="campaign-title" style={labelStyle}>
          Campaign Title <span aria-hidden="true" style={{ color: 'var(--color-status-error)' }}>*</span>
        </label>
        <input
          id="campaign-title"
          type="text"
          value={campaign.title}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange('title', e.target.value)}
          placeholder="Enter your campaign title"
          maxLength={200}
          required
          style={inputStyle}
          aria-required="true"
        />
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-text-tertiary)', marginTop: '4px' }}>
          {campaign.title.length}/200 characters
        </p>
      </div>

      {/* Short description */}
      <div>
        <label htmlFor="campaign-short-description" style={labelStyle}>
          Short Description
        </label>
        <textarea
          id="campaign-short-description"
          value={campaign.shortDescription ?? ''}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
            onChange('shortDescription', e.target.value || null)
          }
          placeholder="A brief summary of your campaign (max 500 characters)"
          maxLength={500}
          rows={3}
          style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
        />
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '11px',
            color: shortDescLen > 500 ? 'var(--color-status-error)' : 'var(--color-text-tertiary)',
            marginTop: '4px',
          }}
        >
          {shortDescLen}/500 characters
        </p>
      </div>

      {/* Category */}
      <div>
        <label htmlFor="campaign-category" style={labelStyle}>
          Category
        </label>
        <select
          id="campaign-category"
          value={campaign.category ?? ''}
          onChange={(e: ChangeEvent<HTMLSelectElement>) =>
            onChange('category', e.target.value || null)
          }
          style={{ ...inputStyle, appearance: 'auto' }}
        >
          <option value="">Select a category</option>
          {(Object.entries(CAMPAIGN_CATEGORY_LABELS) as Array<[CampaignCategory, string]>).map(
            ([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ),
          )}
        </select>
      </div>

      {/* Alignment statement */}
      <div>
        <label htmlFor="campaign-alignment" style={labelStyle}>
          Mars Mission Alignment Statement
        </label>
        <textarea
          id="campaign-alignment"
          value={campaign.alignmentStatement ?? ''}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
            onChange('alignmentStatement', e.target.value || null)
          }
          placeholder="How does this campaign advance humanity's mission to Mars?"
          rows={3}
          style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
        />
      </div>
    </section>
  );
}
