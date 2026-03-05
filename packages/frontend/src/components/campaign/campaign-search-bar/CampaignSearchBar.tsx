import type { ChangeEvent, ReactElement } from 'react';

export interface CampaignSearchBarProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
}

/**
 * CampaignSearchBar — free-text search input for campaign discovery.
 * The parent component is responsible for debouncing changes before URL sync.
 */
export function CampaignSearchBar({
  value,
  onChange,
  placeholder = 'Search missions…',
}: CampaignSearchBarProps): ReactElement {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  const handleClear = () => {
    onChange('');
  };

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      {/* Search icon */}
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: '14px',
          color: 'var(--color-text-tertiary)',
          pointerEvents: 'none',
          fontSize: '16px',
          lineHeight: 1,
        }}
      >
        ⌕
      </span>

      <input
        type="search"
        aria-label="Search campaigns"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        style={{
          width: '100%',
          background: 'var(--color-bg-input)',
          border: '1px solid var(--color-border-input)',
          borderRadius: 'var(--radius-input)',
          color: 'var(--color-text-primary)',
          fontFamily: 'var(--font-body)',
          fontSize: '14px',
          padding: '10px 40px 10px 40px',
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />

      {/* Clear button */}
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={handleClear}
          style={{
            position: 'absolute',
            right: '12px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--color-text-tertiary)',
            fontSize: '16px',
            lineHeight: 1,
            padding: '0',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          ✕
        </button>
      )}
    </div>
  );
}
