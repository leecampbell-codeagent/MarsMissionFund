import { type ReactElement, useState } from 'react';
import { Button } from '../../ui/Button';
import { type NotificationPrefs } from '../../../api/account-api';

interface OnboardingNotificationsStepProps {
  readonly onNext: (prefs: Partial<NotificationPrefs>) => void;
  readonly onBack: () => void;
  readonly isSaving?: boolean;
  readonly initialPrefs?: NotificationPrefs;
}

const DEFAULT_PREFS: NotificationPrefs = {
  campaignUpdates: true,
  milestoneCompletions: true,
  contributionConfirmations: true,
  recommendations: true,
  securityAlerts: true,
  platformAnnouncements: false,
};

interface PrefRow {
  readonly key: keyof NotificationPrefs;
  readonly label: string;
  readonly description: string;
  readonly locked: boolean;
}

const PREF_ROWS: PrefRow[] = [
  {
    key: 'campaignUpdates',
    label: 'Campaign Updates',
    description: 'News from missions you\'re backing.',
    locked: false,
  },
  {
    key: 'milestoneCompletions',
    label: 'Milestone Completions',
    description: 'When a project hits a funded milestone.',
    locked: false,
  },
  {
    key: 'contributionConfirmations',
    label: 'Contribution Confirmations',
    description: 'Receipts and confirmation of your pledges.',
    locked: false,
  },
  {
    key: 'recommendations',
    label: 'Recommendations',
    description: 'Missions we think you\'ll want to back.',
    locked: false,
  },
  {
    key: 'platformAnnouncements',
    label: 'Platform Announcements',
    description: 'MMF news and feature updates.',
    locked: false,
  },
  {
    key: 'securityAlerts',
    label: 'Security Alerts',
    description: 'Critical account security notifications.',
    locked: true,
  },
];

function LockIcon(): ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="currentColor" strokeWidth="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/**
 * OnboardingNotificationsStep — Step 4 of the onboarding flow.
 * Toggle switches for notification preferences.
 * Security alerts are always on and non-interactive.
 */
export function OnboardingNotificationsStep({
  onNext,
  onBack,
  isSaving = false,
  initialPrefs = DEFAULT_PREFS,
}: OnboardingNotificationsStepProps): ReactElement {
  const [prefs, setPrefs] = useState<NotificationPrefs>(initialPrefs);

  const handleToggle = (key: keyof NotificationPrefs, value: boolean) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = () => {
    // Extract non-locked prefs to send
    const { securityAlerts: _, ...editablePrefs } = prefs;
    onNext(editablePrefs);
  };

  return (
    <div>
      <p
        style={{
          fontFamily: 'var(--font-data)',
          fontSize: '11px',
          fontWeight: 400,
          letterSpacing: '0.3em',
          textTransform: 'uppercase',
          color: 'var(--color-text-accent)',
          marginBottom: '16px',
          marginTop: 0,
        }}
      >
        04 — NOTIFICATIONS
      </p>
      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '56px',
          fontWeight: 400,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: 'var(--color-text-primary)',
          marginBottom: '16px',
          marginTop: 0,
          lineHeight: 1.1,
        }}
      >
        STAY IN THE LOOP.
      </h1>
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '16px',
          lineHeight: 1.7,
          color: 'var(--color-text-secondary)',
          marginBottom: '32px',
          marginTop: 0,
        }}
      >
        Choose which updates you want to receive. Security alerts are always on — we&apos;ll only
        send them when it matters.
      </p>

      <fieldset
        style={{
          border: 'none',
          padding: 0,
          margin: '0 0 40px 0',
        }}
      >
        <legend
          style={{
            fontFamily: 'var(--font-data)',
            fontSize: '11px',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: 'var(--color-text-tertiary)',
            marginBottom: '16px',
            display: 'block',
            float: 'left',
            width: '100%',
          }}
        >
          Notification preferences
        </legend>
        {PREF_ROWS.map((row, index) => {
          const isChecked = prefs[row.key] as boolean;
          const isLast = index === PREF_ROWS.length - 1;
          return (
            <div
              key={row.key}
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
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '16px',
                    fontWeight: 500,
                    color: 'var(--color-text-primary)',
                  }}
                >
                  {row.label}
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
                  {row.description}
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
                {row.locked && (
                  <span style={{ color: 'var(--color-text-tertiary)' }}>
                    <LockIcon />
                  </span>
                )}
                <button
                  role="switch"
                  type="button"
                  aria-checked={isChecked}
                  aria-disabled={row.locked ? true : undefined}
                  aria-label={`${row.label} notifications, ${isChecked ? 'on' : 'off'}${row.locked ? ', always on' : ''}`}
                  tabIndex={row.locked ? -1 : 0}
                  onClick={() => {
                    if (!row.locked) {
                      handleToggle(row.key, !isChecked);
                    }
                  }}
                  style={{
                    width: '44px',
                    height: '24px',
                    borderRadius: 'var(--radius-full)',
                    background: isChecked
                      ? 'var(--color-action-primary)'
                      : 'var(--color-border-input)',
                    border: 'none',
                    cursor: row.locked ? 'default' : 'pointer',
                    position: 'relative',
                    opacity: row.locked ? 0.6 : 1,
                    padding: 0,
                    flexShrink: 0,
                    transition: 'background var(--motion-hover)',
                  }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      top: '2px',
                      left: isChecked ? 'calc(100% - 22px)' : '2px',
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
        })}
      </fieldset>

      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
        }}
      >
        <Button variant="ghost" onClick={onBack} type="button">
          Back
        </Button>
        <Button variant="primary" onClick={handleSubmit} isLoading={isSaving} type="button">
          {isSaving ? 'Saving…' : 'Save preferences →'}
        </Button>
      </div>
    </div>
  );
}




























