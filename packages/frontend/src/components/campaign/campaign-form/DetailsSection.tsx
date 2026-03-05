import { type ReactElement, type ChangeEvent } from 'react';
import { type Campaign } from '../../../types/campaign';

interface DetailsSectionProps {
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
 * DetailsSection — Full description (plain text, white-space: pre-wrap), hero image URL.
 * Description is plain text only — XSS protected via white-space: pre-wrap, not dangerouslySetInnerHTML (G-028).
 */
export function DetailsSection({ campaign, onChange }: DetailsSectionProps): ReactElement {
  const descLen = campaign.description?.length ?? 0;

  return (
    <section aria-label="Details" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <h2
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '24px',
          color: 'var(--color-text-primary)',
          textTransform: 'uppercase',
          margin: 0,
        }}
      >
        Details
      </h2>

      {/* Description */}
      <div>
        <label htmlFor="campaign-description" style={labelStyle}>
          Full Description
        </label>
        <textarea
          id="campaign-description"
          value={campaign.description ?? ''}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
            onChange('description', e.target.value || null)
          }
          placeholder="Describe your campaign in detail. Plain text only — formatting is preserved via line breaks."
          maxLength={10000}
          rows={12}
          style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}
        />
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '11px',
            color: descLen > 10000 ? 'var(--color-status-error)' : 'var(--color-text-tertiary)',
            marginTop: '4px',
          }}
        >
          {descLen}/10,000 characters
        </p>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-text-tertiary)', marginTop: '2px' }}>
          Plain text only. HTML tags will appear as literal characters.
        </p>
      </div>

      {/* Hero image URL */}
      <div>
        <label htmlFor="campaign-hero-image" style={labelStyle}>
          Hero Image URL
        </label>
        <input
          id="campaign-hero-image"
          type="url"
          value={campaign.heroImageUrl ?? ''}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            onChange('heroImageUrl', e.target.value || null)
          }
          placeholder="https://example.com/image.jpg"
          style={inputStyle}
        />
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-text-tertiary)', marginTop: '4px' }}>
          Must be a secure HTTPS URL. Leave blank to use a gradient background.
        </p>
      </div>
    </section>
  );
}
