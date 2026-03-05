import { type ReactElement, type ChangeEvent } from 'react';
import { type Campaign, type RiskDisclosure } from '../../../types/campaign';
import { Button } from '../../ui/Button';

interface RiskSectionProps {
  readonly campaign: Campaign;
  readonly onChange: (field: string, value: RiskDisclosure[]) => void;
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

const riskCardStyle: React.CSSProperties = {
  background: 'var(--color-bg-elevated)',
  border: '1px solid var(--color-border-subtle)',
  borderRadius: 'var(--radius-card)',
  padding: '16px',
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
};

/**
 * RiskSection — Risk disclosures with add/remove functionality.
 * At least 1 risk disclosure required at submission.
 */
export function RiskSection({ campaign, onChange }: RiskSectionProps): ReactElement {
  const risks = campaign.riskDisclosures;

  const addRisk = () => {
    const newRisk: RiskDisclosure = {
      id: crypto.randomUUID(),
      risk: '',
      mitigation: '',
    };
    onChange('riskDisclosures', [...risks, newRisk]);
  };

  const removeRisk = (index: number) => {
    onChange('riskDisclosures', risks.filter((_, i) => i !== index));
  };

  const updateRisk = (index: number, field: keyof RiskDisclosure, value: string) => {
    const updated = risks.map((r, i) =>
      i === index ? { ...r, [field]: value } : r,
    ) as RiskDisclosure[];
    onChange('riskDisclosures', updated);
  };

  return (
    <section aria-label="Risk Disclosures" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <h2
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '24px',
          color: 'var(--color-text-primary)',
          textTransform: 'uppercase',
          margin: 0,
        }}
      >
        Risk Disclosures
      </h2>
      <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>
        At least 1 risk disclosure required. Max 10. Be transparent about potential challenges.
      </p>

      {risks.length === 0 && (
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--color-text-tertiary)', textAlign: 'center', padding: '24px' }}>
          No risk disclosures added yet.
        </p>
      )}

      {risks.map((risk, index) => (
        <div key={index} style={riskCardStyle} aria-label={`Risk disclosure ${index + 1}`}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
              Risk {index + 1}
            </span>
            <Button variant="ghost" size="sm" onClick={() => removeRisk(index)} aria-label={`Remove risk disclosure ${index + 1}`}>
              Remove
            </Button>
          </div>

          <div>
            <label htmlFor={`risk-risk-${index}`} style={labelStyle}>Risk *</label>
            <textarea
              id={`risk-risk-${index}`}
              value={risk.risk}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => updateRisk(index, 'risk', e.target.value)}
              placeholder="Describe the risk (max 500 chars)"
              maxLength={500}
              rows={2}
              required
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>

          <div>
            <label htmlFor={`risk-mitigation-${index}`} style={labelStyle}>Mitigation *</label>
            <textarea
              id={`risk-mitigation-${index}`}
              value={risk.mitigation}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => updateRisk(index, 'mitigation', e.target.value)}
              placeholder="How will you mitigate this risk? (max 500 chars)"
              maxLength={500}
              rows={2}
              required
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>
        </div>
      ))}

      {risks.length < 10 && (
        <Button
          variant="secondary"
          size="sm"
          onClick={addRisk}
          disabled={risks.length >= 10}
        >
          + Add Risk Disclosure
        </Button>
      )}
    </section>
  );
}
