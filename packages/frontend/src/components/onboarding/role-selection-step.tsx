import { type ReactElement } from 'react';

type Role = 'backer' | 'creator' | 'both';

interface RoleSelectionStepProps {
  readonly selectedRole: Role;
  readonly onRoleChange: (role: Role) => void;
  readonly onContinue: () => void;
  readonly onBack: () => void;
  readonly isLoading?: boolean;
  readonly error?: string | null;
}

interface RoleOption {
  readonly id: Role;
  readonly icon: string;
  readonly title: string;
  readonly description: string;
}

const ROLES: readonly RoleOption[] = [
  {
    id: 'backer',
    icon: '🚀',
    title: 'Backer',
    description: 'Back missions and track their progress to Mars.',
  },
  {
    id: 'creator',
    icon: '🛰️',
    title: 'Creator',
    description: 'Launch campaigns and bring Mars missions to life.',
  },
  {
    id: 'both',
    icon: '🪐',
    title: 'Both',
    description: 'Back missions and create your own campaigns.',
  },
];

export function RoleSelectionStep({
  selectedRole,
  onRoleChange,
  onContinue,
  onBack,
  isLoading = false,
  error = null,
}: RoleSelectionStepProps): ReactElement {
  const showKycCallout = selectedRole === 'creator' || selectedRole === 'both';

  function handleKeyDown(event: React.KeyboardEvent, role: Role): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onRoleChange(role);
    }
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      const currentIndex = ROLES.findIndex((r) => r.id === selectedRole);
      const nextIndex = (currentIndex + 1) % ROLES.length;
      const nextRole = ROLES[nextIndex];
      if (nextRole) onRoleChange(nextRole.id);
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      const currentIndex = ROLES.findIndex((r) => r.id === selectedRole);
      const prevIndex = (currentIndex - 1 + ROLES.length) % ROLES.length;
      const prevRole = ROLES[prevIndex];
      if (prevRole) onRoleChange(prevRole.id);
    }
  }

  return (
    <>
      <div className="role-step">
        <h1 className="role-step__heading">CHOOSE YOUR ROLE</h1>
        <p className="role-step__subheading">How do you want to participate in the Mars mission?</p>

        <div
          className="role-step__cards"
          role="radiogroup"
          aria-label="Select your role"
        >
          {ROLES.map((role) => {
            const isSelected = selectedRole === role.id;
            return (
              <div
                key={role.id}
                role="radio"
                aria-checked={isSelected}
                tabIndex={isSelected ? 0 : -1}
                className={`role-card${isSelected ? ' role-card--selected' : ''}`}
                onClick={() => onRoleChange(role.id)}
                onKeyDown={(e) => handleKeyDown(e, role.id)}
              >
                <span className="role-card__icon" aria-hidden="true">
                  {role.icon}
                </span>
                <h2 className="role-card__title">{role.title}</h2>
                <p className="role-card__description">{role.description}</p>
              </div>
            );
          })}
        </div>

        {showKycCallout && (
          <div className="role-step__kyc-callout" role="status">
            Creator accounts require identity verification (KYC) to submit campaigns. You can
            complete this later.
          </div>
        )}

        {error && (
          <p className="role-step__error" role="alert">
            {error}
          </p>
        )}

        <div className="role-step__buttons">
          <button type="button" className="btn-ghost" onClick={onBack}>
            Back
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={onContinue}
            disabled={isLoading}
            aria-busy={isLoading}
          >
            {isLoading ? (
              <>
                <span className="btn-spinner" aria-hidden="true" />
                <span>Saving...</span>
              </>
            ) : (
              'Continue'
            )}
          </button>
        </div>
      </div>
      <style>{`
        .role-step {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }

        .role-step__heading {
          font-family: var(--font-display);
          font-size: 40px;
          font-weight: 400;
          letter-spacing: 0.04em;
          color: var(--color-text-primary);
          text-transform: uppercase;
          line-height: 1;
          margin-bottom: 8px;
        }

        @media (min-width: 640px) {
          .role-step__heading {
            font-size: 56px;
          }
        }

        .role-step__subheading {
          font-family: var(--font-body);
          font-size: 16px;
          font-weight: 400;
          line-height: 1.7;
          color: var(--color-text-secondary);
          margin-bottom: 32px;
        }

        .role-step__cards {
          display: flex;
          flex-direction: column;
          gap: 16px;
          width: 100%;
          margin-bottom: 24px;
        }

        @media (min-width: 640px) {
          .role-step__cards {
            flex-direction: row;
          }
        }

        .role-card {
          background: var(--color-bg-surface);
          border: 1px solid var(--color-border-subtle);
          border-radius: var(--radius-card);
          padding: 24px;
          cursor: pointer;
          text-align: center;
          flex: 1;
          transition:
            background var(--motion-hover-duration) var(--motion-hover-easing),
            border-color var(--motion-hover-duration) var(--motion-hover-easing);
          outline: none;
        }

        @media (min-width: 640px) {
          .role-card {
            min-height: 140px;
          }
        }

        .role-card:hover:not(.role-card--selected) {
          background: var(--color-bg-elevated);
          border-color: var(--color-border-input);
        }

        .role-card--selected {
          border: 2px solid var(--color-action-primary);
          box-shadow: 0 0 0 3px rgba(255, 92, 26, 0.15);
        }

        .role-card:focus-visible {
          border-color: var(--color-action-primary);
          box-shadow: 0 0 0 3px rgba(255, 92, 26, 0.15);
        }

        .role-card__icon {
          display: block;
          font-size: 40px;
          margin-bottom: 12px;
          line-height: 1;
        }

        .role-card__title {
          font-family: var(--font-body);
          font-size: 24px;
          font-weight: 700;
          color: var(--color-text-primary);
          margin-bottom: 8px;
          line-height: 1.2;
        }

        .role-card__description {
          font-family: var(--font-body);
          font-size: 13px;
          font-weight: 400;
          line-height: 1.7;
          color: var(--color-text-secondary);
        }

        .role-step__kyc-callout {
          background: rgba(26, 58, 110, 0.1);
          border: 1px solid rgba(26, 58, 110, 0.2);
          border-radius: var(--radius-input);
          padding: 16px;
          margin-bottom: 24px;
          font-family: var(--font-body);
          font-size: 13px;
          font-weight: 400;
          line-height: 1.7;
          color: var(--color-text-secondary);
          text-align: left;
          animation:
            kyc-slide-in var(--motion-enter-duration) var(--motion-enter-easing),
            kyc-fade-in var(--motion-enter-duration) var(--motion-enter-easing);
          width: 100%;
        }

        @keyframes kyc-slide-in {
          from { transform: translateY(-8px); }
          to { transform: translateY(0); }
        }

        @keyframes kyc-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @media (prefers-reduced-motion: reduce) {
          .role-step__kyc-callout {
            animation: none;
          }
        }

        .role-step__error {
          font-family: var(--font-body);
          font-size: 13px;
          color: var(--color-text-error);
          margin-bottom: 16px;
        }

        .role-step__buttons {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          margin-top: 8px;
          width: 100%;
          flex-wrap: wrap;
        }

        .btn-ghost {
          background: transparent;
          color: var(--color-action-ghost-text);
          border: 1px solid var(--color-action-ghost-border);
          border-radius: var(--radius-button);
          font-family: var(--font-body);
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 0.01em;
          padding: 12px 24px;
          cursor: pointer;
          transition: background var(--motion-hover-duration) var(--motion-hover-easing);
        }

        .btn-ghost:hover {
          background: rgba(255, 92, 26, 0.05);
        }

        .btn-ghost:focus-visible {
          outline: 2px solid var(--color-action-primary-hover);
          outline-offset: 2px;
        }

        .btn-primary {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: var(--gradient-action-primary);
          color: var(--color-action-primary-text);
          border: none;
          border-radius: var(--radius-button);
          font-family: var(--font-body);
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 0.01em;
          padding: 12px 32px;
          cursor: pointer;
          box-shadow: 0 4px 16px var(--color-action-primary-shadow);
          transition: opacity var(--motion-hover-duration) var(--motion-hover-easing);
        }

        .btn-primary:hover:not(:disabled) {
          opacity: 0.9;
        }

        .btn-primary:focus-visible {
          outline: 2px solid var(--color-action-primary-hover);
          outline-offset: 2px;
        }

        .btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(245, 248, 255, 0.3);
          border-top-color: var(--color-action-primary-text);
          border-radius: 50%;
          animation: btn-spin 800ms linear infinite;
          flex-shrink: 0;
        }

        @keyframes btn-spin {
          to { transform: rotate(360deg); }
        }

        @media (prefers-reduced-motion: reduce) {
          .btn-spinner {
            animation: none;
            opacity: 0.5;
          }
        }
      `}</style>
    </>
  );
}
