import { type ReactElement } from 'react';

interface ToggleSwitchProps {
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly disabled?: boolean;
  readonly id: string;
}

export function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
  id,
}: ToggleSwitchProps): ReactElement {
  function handleClick(): void {
    if (!disabled) {
      onChange(!checked);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent): void {
    if (!disabled && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      onChange(!checked);
    }
  }

  return (
    <>
      <button
        type="button"
        role="switch"
        id={id}
        aria-checked={checked}
        aria-disabled={disabled}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={`toggle-switch${checked ? ' toggle-switch--on' : ''}${disabled ? ' toggle-switch--disabled' : ''}`}
      >
        <span className="toggle-switch__thumb" />
      </button>
      <style>{`
        .toggle-switch {
          position: relative;
          display: inline-flex;
          align-items: center;
          width: 44px;
          height: 24px;
          border-radius: var(--radius-progress);
          background: var(--color-bg-input);
          border: 1px solid var(--color-border-input);
          cursor: pointer;
          transition:
            background var(--motion-hover-duration) var(--motion-hover-easing),
            border-color var(--motion-hover-duration) var(--motion-hover-easing);
          flex-shrink: 0;
          padding: 0;
        }

        .toggle-switch:focus-visible {
          outline: 2px solid var(--color-action-primary-hover);
          outline-offset: 2px;
        }

        .toggle-switch--on {
          background: var(--color-action-primary);
          border-color: var(--color-action-primary);
        }

        .toggle-switch--disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .toggle-switch__thumb {
          position: absolute;
          left: 3px;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: var(--color-action-primary-text);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
          transition: left var(--motion-hover-duration) var(--motion-hover-easing);
        }

        .toggle-switch--on .toggle-switch__thumb {
          left: 23px;
        }
      `}</style>
    </>
  );
}
