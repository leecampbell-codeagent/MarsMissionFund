import type { ReactElement } from 'react';

interface NotificationToggleRowProps {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly checked: boolean;
  readonly locked?: boolean;
  readonly onChange?: (checked: boolean) => void;
  readonly isLast?: boolean;
}

function LockIcon(): ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect
        x="3"
        y="11"
        width="18"
        height="11"
        rx="2"
        ry="2"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M7 11V7a5 5 0 0 1 10 0v4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * NotificationToggleRow — a single toggle row for notification preferences.
 * Implements design spec NotificationToggleRow component.
 */
export function NotificationToggleRow({
  id,
  label,
  description,
  checked,
  locked = false,
  onChange,
  isLast = false,
}: NotificationToggleRowProps): ReactElement {
  const handleClick = () => {
    if (!locked && onChange) {
      onChange(!checked);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '20px 0',
        borderBottom: isLast ? 'none' : '1px solid var(--color-border-subtle)',
      }}
    >
      <div style={{ flex: 1 }}>
        <div
          id={`${id}-label`}
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '16px',
            fontWeight: 500,
            color: 'var(--color-text-primary)',
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '13px',
            color: 'var(--color-text-secondary)',
            marginTop: '2px',
            lineHeight: 1.7,
          }}
        >
          {description}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginLeft: '16px',
        }}
      >
        {locked && (
          <span style={{ color: 'var(--color-text-tertiary)' }}>
            <LockIcon />
          </span>
        )}
        <button
          role="switch"
          type="button"
          aria-checked={checked}
          aria-disabled={locked ? true : undefined}
          aria-label={`${label} notifications, ${checked ? 'on' : 'off'}${locked ? ', always on' : ''}`}
          aria-labelledby={`${id}-label`}
          tabIndex={locked ? -1 : 0}
          onClick={handleClick}
          style={{
            width: '44px',
            height: '24px',
            borderRadius: 'var(--radius-full)',
            background: checked ? 'var(--color-action-primary)' : 'var(--color-border-input)',
            border: 'none',
            cursor: locked ? 'default' : 'pointer',
            position: 'relative',
            opacity: locked ? 0.6 : 1,
            padding: 0,
            flexShrink: 0,
            transition: 'background var(--motion-hover)',
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: '2px',
              left: checked ? 'calc(100% - 22px)' : '2px',
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              background: 'var(--color-action-primary-text)',
              transition: 'left var(--motion-hover)',
            }}
          />
        </button>
      </div>
    </div>
  );
}
