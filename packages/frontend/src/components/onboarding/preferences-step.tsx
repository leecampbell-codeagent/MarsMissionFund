import { type ReactElement } from 'react';
import { type NotificationPreferences } from '../../api/account-api';
import { ToggleSwitch } from '../ui/toggle-switch';

interface PreferencesStepProps {
  readonly preferences: NotificationPreferences;
  readonly onPreferenceChange: (key: keyof NotificationPreferences, value: boolean) => void;
  readonly onComplete: () => void;
  readonly onSkip: () => void;
  readonly onBack: () => void;
  readonly isLoading?: boolean;
  readonly error?: string | null;
}

interface PreferenceRow {
  readonly key: keyof NotificationPreferences;
  readonly label: string;
  readonly description: string;
  readonly locked?: boolean;
}

const PREFERENCE_ROWS: readonly PreferenceRow[] = [
  {
    key: 'campaign_updates',
    label: 'Campaign Updates',
    description: 'Get notified when campaigns you back post updates',
  },
  {
    key: 'milestone_completions',
    label: 'Milestone Completions',
    description: 'Know when missions hit their targets',
  },
  {
    key: 'contribution_confirmations',
    label: 'Contribution Confirmations',
    description: 'Confirmation when your contributions are processed',
  },
  {
    key: 'new_campaign_recommendations',
    label: 'New Campaigns',
    description: "Discover new Mars missions we think you'll like",
  },
  {
    key: 'platform_announcements',
    label: 'Platform Announcements',
    description: 'Mars Mission Fund product news and features',
  },
  {
    key: 'security_alerts',
    label: 'Security Alerts',
    description: 'Security alerts cannot be disabled.',
    locked: true,
  },
];

export function PreferencesStep({
  preferences,
  onPreferenceChange,
  onComplete,
  onSkip,
  onBack,
  isLoading = false,
  error = null,
}: PreferencesStepProps): ReactElement {
  return (
    <>
      <div className="prefs-step">
        <h1 className="prefs-step__heading">NOTIFICATION PREFERENCES</h1>
        <p className="prefs-step__subheading">
          Choose how you want to stay informed about the Mars missions you care about.
        </p>

        <div className="prefs-step__list">
          {PREFERENCE_ROWS.map((row, index) => {
            const isLast = index === PREFERENCE_ROWS.length - 1;
            const toggleId = `pref-toggle-${row.key}`;
            const labelId = `pref-label-${row.key}`;
            const descId = `pref-desc-${row.key}`;

            return (
              <div
                key={row.key}
                className={`pref-row${!isLast ? ' pref-row--bordered' : ''}`}
              >
                <div className="pref-row__content">
                  <div>
                    <p id={labelId} className="pref-row__label">
                      {row.label}
                      {row.locked && (
                        <span className="pref-row__lock" aria-hidden="true">
                          {' '}
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                          </svg>
                        </span>
                      )}
                    </p>
                    <p id={descId} className={`pref-row__desc${row.locked ? ' pref-row__desc--locked' : ''}`}>
                      {row.description}
                    </p>
                  </div>
                  <div
                    className="pref-row__toggle"
                    style={row.locked ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
                  >
                    <label htmlFor={toggleId} className="sr-only">
                      {row.label}
                    </label>
                    <ToggleSwitch
                      id={toggleId}
                      checked={preferences[row.key]}
                      onChange={(val) => !row.locked && onPreferenceChange(row.key, val)}
                      disabled={row.locked}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {error && (
          <p className="prefs-step__error" role="alert">
            {error}
          </p>
        )}

        <div className="prefs-step__buttons">
          <button type="button" className="btn-ghost" onClick={onBack}>
            Back
          </button>
          <div className="prefs-step__right-buttons">
            <button type="button" className="btn-secondary" onClick={onSkip}>
              Skip
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={onComplete}
              disabled={isLoading}
              aria-busy={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="btn-spinner" aria-hidden="true" />
                  <span>Saving...</span>
                </>
              ) : (
                'Complete Setup'
              )}
            </button>
          </div>
        </div>
      </div>
      <style>{`
        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border-width: 0;
        }

        .prefs-step {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          width: 100%;
        }

        .prefs-step__heading {
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
          .prefs-step__heading {
            font-size: 56px;
          }
        }

        .prefs-step__subheading {
          font-family: var(--font-body);
          font-size: 16px;
          font-weight: 400;
          line-height: 1.7;
          color: var(--color-text-secondary);
          margin-bottom: 32px;
        }

        .prefs-step__list {
          width: 100%;
          background: var(--color-bg-surface);
          border: 1px solid var(--color-border-subtle);
          border-radius: var(--radius-card);
          overflow: hidden;
          margin-bottom: 24px;
        }

        .pref-row {
          padding: 0;
        }

        .pref-row--bordered {
          border-bottom: 1px solid var(--color-border-subtle);
        }

        .pref-row__content {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 24px;
          gap: 16px;
        }

        .pref-row__label {
          font-family: var(--font-body);
          font-size: 16px;
          font-weight: 400;
          color: var(--color-text-primary);
          margin-bottom: 2px;
          display: flex;
          align-items: center;
          gap: 6px;
          text-align: left;
        }

        .pref-row__lock {
          color: var(--color-text-tertiary);
          display: inline-flex;
          align-items: center;
        }

        .pref-row__desc {
          font-family: var(--font-body);
          font-size: 13px;
          font-weight: 400;
          line-height: 1.7;
          color: var(--color-text-secondary);
          text-align: left;
        }

        .pref-row__desc--locked {
          color: var(--color-text-tertiary);
        }

        .pref-row__toggle {
          flex-shrink: 0;
          padding: 12px;
          margin: -12px;
        }

        .prefs-step__error {
          font-family: var(--font-body);
          font-size: 13px;
          color: var(--color-text-error);
          margin-bottom: 16px;
          width: 100%;
          text-align: left;
        }

        .prefs-step__buttons {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          margin-top: 8px;
          width: 100%;
          flex-wrap: wrap;
        }

        .prefs-step__right-buttons {
          display: flex;
          gap: 12px;
          align-items: center;
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

        .btn-secondary {
          background: var(--color-action-secondary-bg);
          color: var(--color-action-secondary-text);
          border: 1px solid var(--color-action-secondary-border);
          border-radius: var(--radius-button);
          font-family: var(--font-body);
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 0.01em;
          padding: 12px 24px;
          cursor: pointer;
          transition: background var(--motion-hover-duration) var(--motion-hover-easing);
        }

        .btn-secondary:hover {
          background: var(--color-bg-elevated);
        }

        .btn-secondary:focus-visible {
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
