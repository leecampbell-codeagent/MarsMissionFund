import { type ReactElement, type ChangeEvent } from 'react';
import { type Campaign, type BudgetItem } from '../../../types/campaign';
import { Button } from '../../ui/Button';

interface BudgetSectionProps {
  readonly campaign: Campaign;
  readonly onChange: (field: string, value: BudgetItem[]) => void;
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

const budgetCardStyle: React.CSSProperties = {
  background: 'var(--color-bg-elevated)',
  border: '1px solid var(--color-border-subtle)',
  borderRadius: 'var(--radius-card)',
  padding: '16px',
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
};

/**
 * BudgetSection — Budget breakdown line items (optional).
 */
export function BudgetSection({ campaign, onChange }: BudgetSectionProps): ReactElement {
  const items = campaign.budgetBreakdown;

  const addItem = () => {
    const newItem: BudgetItem = {
      category: '',
      description: '',
      amountCents: '0',
    };
    onChange('budgetBreakdown', [...items, newItem]);
  };

  const removeItem = (index: number) => {
    onChange('budgetBreakdown', items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof BudgetItem, value: string) => {
    const updated = items.map((item, i) =>
      i === index ? { ...item, [field]: value } : item,
    );
    onChange('budgetBreakdown', updated);
  };

  const handleAmountChange = (index: number, dollars: string) => {
    const num = parseFloat(dollars);
    const cents = isNaN(num) ? '0' : String(Math.round(num * 100));
    updateItem(index, 'amountCents', cents);
  };

  return (
    <section aria-label="Budget Breakdown" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <h2
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '24px',
          color: 'var(--color-text-primary)',
          textTransform: 'uppercase',
          margin: 0,
        }}
      >
        Budget Breakdown
        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '12px',
            color: 'var(--color-text-tertiary)',
            textTransform: 'none',
            fontWeight: 400,
            marginLeft: '12px',
          }}
        >
          (optional)
        </span>
      </h2>
      <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>
        Provide a breakdown of how you plan to use the funding.
      </p>

      {items.length === 0 && (
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--color-text-tertiary)', textAlign: 'center', padding: '24px' }}>
          No budget items added yet.
        </p>
      )}

      {items.map((item, index) => (
        <div key={index} style={budgetCardStyle} aria-label={`Budget item ${index + 1}`}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
              Item {index + 1}
            </span>
            <Button variant="ghost" size="sm" onClick={() => removeItem(index)} aria-label={`Remove budget item ${index + 1}`}>
              Remove
            </Button>
          </div>

          <div>
            <label htmlFor={`budget-category-${index}`} style={labelStyle}>Category *</label>
            <input
              id={`budget-category-${index}`}
              type="text"
              value={item.category}
              onChange={(e: ChangeEvent<HTMLInputElement>) => updateItem(index, 'category', e.target.value)}
              placeholder="e.g. R&D, Equipment, Personnel"
              required
              style={inputStyle}
            />
          </div>

          <div>
            <label htmlFor={`budget-description-${index}`} style={labelStyle}>Description *</label>
            <input
              id={`budget-description-${index}`}
              type="text"
              value={item.description}
              onChange={(e: ChangeEvent<HTMLInputElement>) => updateItem(index, 'description', e.target.value)}
              placeholder="What will this budget cover?"
              required
              style={inputStyle}
            />
          </div>

          <div>
            <label htmlFor={`budget-amount-${index}`} style={labelStyle}>Amount (USD) *</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontFamily: 'var(--font-data)', color: 'var(--color-text-tertiary)', pointerEvents: 'none' }}>
                $
              </span>
              <input
                id={`budget-amount-${index}`}
                type="number"
                min="0"
                step="1000"
                defaultValue={Number(item.amountCents) / 100}
                onChange={(e: ChangeEvent<HTMLInputElement>) => handleAmountChange(index, e.target.value)}
                placeholder="0"
                required
                style={{ ...inputStyle, paddingLeft: '24px' }}
              />
            </div>
          </div>
        </div>
      ))}

      <Button variant="secondary" size="sm" onClick={addItem}>
        + Add Budget Item
      </Button>
    </section>
  );
}
