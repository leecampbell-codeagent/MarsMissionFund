import { type ReactElement } from 'react';
import { CAMPAIGN_CATEGORY_LABELS, type CampaignCategory } from '../../../types/campaign';

const CATEGORIES = Object.keys(CAMPAIGN_CATEGORY_LABELS) as CampaignCategory[];

export interface CategoryFilterProps {
  readonly selected: readonly string[];
  readonly onChange: (selected: string[]) => void;
}

/**
 * CategoryFilter — multi-select category filter for campaign discovery.
 * Displays human-readable labels from the category label map.
 * Emits the updated selection array on every change.
 */
export function CategoryFilter({ selected, onChange }: CategoryFilterProps): ReactElement {
  const handleToggle = (category: string) => {
    if (selected.includes(category)) {
      onChange(selected.filter((c) => c !== category));
    } else {
      onChange([...selected, category]);
    }
  };

  return (
    <fieldset
      style={{
        border: 'none',
        padding: 0,
        margin: 0,
      }}
    >
      <legend
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '11px',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--color-text-tertiary)',
          marginBottom: '8px',
          display: 'block',
        }}
      >
        Category
      </legend>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px',
        }}
      >
        {CATEGORIES.map((category) => {
          const isActive = selected.includes(category);
          return (
            <button
              key={category}
              type="button"
              aria-pressed={isActive}
              aria-label={`Filter by ${CAMPAIGN_CATEGORY_LABELS[category]}`}
              onClick={() => handleToggle(category)}
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '12px',
                padding: '5px 12px',
                borderRadius: 'var(--radius-badge)',
                border: isActive
                  ? '1px solid var(--color-action-primary)'
                  : '1px solid var(--color-border-input)',
                background: isActive
                  ? 'var(--color-status-active-bg)'
                  : 'var(--color-bg-input)',
                color: isActive
                  ? 'var(--color-action-primary)'
                  : 'var(--color-text-secondary)',
                cursor: 'pointer',
                transition: 'border-color var(--motion-hover), background var(--motion-hover)',
                userSelect: 'none',
              }}
            >
              {CAMPAIGN_CATEGORY_LABELS[category]}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
