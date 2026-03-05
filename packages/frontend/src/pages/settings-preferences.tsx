import { type ReactElement, useEffect, useRef, useState } from 'react';
import type { NotificationPreferences } from '../api/account-api';
import { ToggleSwitch } from '../components/ui/toggle-switch';
import { useAccount } from '../hooks/account/use-account';
import { useUpdatePreferences } from '../hooks/account/use-update-preferences';

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

export default function PreferencesSettingsPage(): ReactElement {
  const { data: account, isLoading } = useAccount();
  const updatePreferences = useUpdatePreferences();

  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (account && preferences === null) {
      setPreferences(account.notification_preferences);
    }
  }, [account, preferences]);

  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  function handleToggle(key: keyof NotificationPreferences, value: boolean): void {
    setPreferences((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  const hasChanges =
    preferences !== null &&
    account !== undefined &&
    JSON.stringify(preferences) !== JSON.stringify(account.notification_preferences);

  async function handleSave(): Promise<void> {
    if (!preferences) return;
    setSaveError(null);
    setSuccessMessage(null);
    try {
      await updatePreferences.mutateAsync(preferences);
      setSuccessMessage('Preferences updated successfully.');
      successTimerRef.current = setTimeout(() => setSuccessMessage(null), 5000);
    } catch {
      setSaveError("We couldn't save your preferences. Try again.");
    }
  }

  if (isLoading || preferences === null) {
    return (
      <div className="settings-page">
        <div className="settings-page__content">
          <div className="skeleton skeleton--label" />
          <div className="skeleton skeleton--heading" />
          <div className="skeleton skeleton--card" />
        </div>
        <style>{`
          .settings-page {
            display: flex;
            justify-content: center;
            flex: 1;
            padding: 24px 0;
          }
          @media (min-width: 768px) { .settings-page { padding: 32px 0; } }
          @media (min-width: 1024px) { .settings-page { padding: 48px 0; } }
          .settings-page__content { max-width: 600px; width: 100%; }
          .skeleton {
            background: var(--color-bg-input);
            border-radius: var(--radius-input);
            animation: skel-pulse 1.5s ease-in-out infinite alternate;
          }
          .skeleton--label { height: 16px; width: 120px; margin-bottom: 16px; }
          .skeleton--heading { height: 48px; width: 280px; margin-bottom: 32px; }
          .skeleton--card { height: 360px; width: 100%; border-radius: var(--radius-card); }
          @keyframes skel-pulse {
            from { opacity: 0.5; }
            to { opacity: 1; }
          }
          @media (prefers-reduced-motion: reduce) {
            .skeleton { animation: none; opacity: 0.7; }
          }
        `}</style>
      </div>
    );
  }

  return (
    <>
      <div className="settings-page">
        <div className="settings-page__content">
          <p className="settings-page__section-label">02 — PREFERENCES</p>
          <h1 className="settings-page__heading">NOTIFICATIONS</h1>

          {successMessage && (
            <output className="settings-page__success" aria-live="polite">
              {successMessage}
            </output>
          )}

          {saveError && (
            <div className="settings-page__save-error" role="alert">
              {saveError}
            </div>
          )}

          <div className="prefs-list">
            {PREFERENCE_ROWS.map((row, index) => {
              const isLast = index === PREFERENCE_ROWS.length - 1;
              const toggleId = `settings-pref-${row.key}`;
              const labelId = `settings-pref-label-${row.key}`;

              return (
                <div key={row.key} className={`pref-row${!isLast ? ' pref-row--bordered' : ''}`}>
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
                      <p className={`pref-row__desc${row.locked ? ' pref-row__desc--locked' : ''}`}>
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
                        onChange={(val) => !row.locked && handleToggle(row.key, val)}
                        disabled={row.locked}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="settings-page__button-row">
            <button
              type="button"
              className="btn-primary"
              onClick={() => void handleSave()}
              disabled={updatePreferences.isPending || !hasChanges}
              aria-busy={updatePreferences.isPending}
            >
              {updatePreferences.isPending ? (
                <>
                  <span className="btn-spinner" aria-hidden="true" />
                  <span>Saving...</span>
                </>
              ) : (
                'Save Preferences'
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

        .settings-page {
          display: flex;
          justify-content: center;
          flex: 1;
          padding: 24px 0;
        }

        @media (min-width: 768px) {
          .settings-page {
            padding: 32px 0;
          }
        }

        @media (min-width: 1024px) {
          .settings-page {
            padding: 48px 0;
          }
        }

        .settings-page__content {
          max-width: 600px;
          width: 100%;
        }

        .settings-page__section-label {
          font-family: var(--font-data);
          font-size: 11px;
          font-weight: 400;
          letter-spacing: 0.3em;
          text-transform: uppercase;
          color: var(--color-text-accent);
          margin-bottom: 16px;
        }

        .settings-page__heading {
          font-family: var(--font-display);
          font-size: 40px;
          font-weight: 400;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--color-text-primary);
          line-height: 1;
          margin-bottom: 32px;
        }

        @media (min-width: 640px) {
          .settings-page__heading {
            font-size: 56px;
          }
        }

        .settings-page__success {
          background: var(--color-status-success-bg);
          border: 1px solid var(--color-status-success-border);
          border-radius: var(--radius-input);
          padding: 12px 16px;
          font-family: var(--font-body);
          font-size: 13px;
          color: var(--color-text-success);
          margin-bottom: 24px;
          animation:
            success-slide var(--motion-enter-duration) var(--motion-enter-easing),
            success-fade var(--motion-enter-duration) var(--motion-enter-easing);
        }

        @keyframes success-slide {
          from { transform: translateY(-8px); }
          to { transform: translateY(0); }
        }

        @keyframes success-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @media (prefers-reduced-motion: reduce) {
          .settings-page__success {
            animation: none;
          }
        }

        .settings-page__save-error {
          background: rgba(193, 68, 14, 0.1);
          border: 1px solid var(--color-status-error);
          border-radius: var(--radius-input);
          padding: 12px 16px;
          font-family: var(--font-body);
          font-size: 13px;
          color: var(--color-text-error);
          margin-bottom: 24px;
        }

        .prefs-list {
          background: var(--color-bg-surface);
          border: 1px solid var(--color-border-subtle);
          border-radius: var(--radius-card);
          overflow: hidden;
          margin-bottom: 32px;
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
        }

        .pref-row__lock {
          color: var(--color-text-tertiary);
          display: inline-flex;
          align-items: center;
        }

        .pref-row__desc {
          font-family: var(--font-body);
          font-size: 13px;
          color: var(--color-text-secondary);
        }

        .pref-row__desc--locked {
          color: var(--color-text-tertiary);
        }

        .pref-row__toggle {
          flex-shrink: 0;
          padding: 12px;
          margin: -12px;
        }

        .settings-page__button-row {
          display: flex;
          justify-content: flex-end;
          margin-top: 32px;
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
          background: var(--gradient-action-primary);
          opacity: 0.4;
          cursor: not-allowed;
          box-shadow: none;
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
