import { useState } from 'react';
import { useUpdateNotificationPreferences } from '../../hooks/use-update-notification-preferences.js';
import type { NotificationPreferencesResponse } from '../../types/user.js';
import { LoadingSpinner } from '../ui/loading-spinner.js';

interface NotificationPreferencesFormProps {
  readonly initialPreferences: NotificationPreferencesResponse;
}

interface ToggleRowProps {
  readonly id: string;
  readonly label: string;
  readonly checked: boolean;
  readonly disabled?: boolean;
  readonly onChange?: (checked: boolean) => void;
}

function ToggleRow({ id, label, checked, disabled = false, onChange }: ToggleRowProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 0',
        borderBottom: '1px solid var(--color-border-subtle)',
      }}
    >
      <label
        htmlFor={id}
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '15px',
          color: disabled ? 'var(--color-text-tertiary)' : 'var(--color-text-secondary)',
          cursor: disabled ? 'default' : 'pointer',
        }}
      >
        {label}
      </label>
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
        aria-checked={checked}
        style={{ cursor: disabled ? 'default' : 'pointer' }}
      />
    </div>
  );
}

export function NotificationPreferencesForm({
  initialPreferences,
}: NotificationPreferencesFormProps) {
  const [prefs, setPrefs] = useState({
    campaign_updates: initialPreferences.campaign_updates,
    milestone_completions: initialPreferences.milestone_completions,
    contribution_confirmations: initialPreferences.contribution_confirmations,
    new_recommendations: initialPreferences.new_recommendations,
    platform_announcements: initialPreferences.platform_announcements,
  });
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const updatePrefs = useUpdateNotificationPreferences();

  const handleToggle = (key: keyof typeof prefs, value: boolean) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
    setSuccessMessage(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage(null);

    updatePrefs.mutate(prefs, {
      onSuccess: () => {
        setSuccessMessage('Notification preferences saved.');
      },
    });
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <ToggleRow
        id="pref-campaign-updates"
        label="Campaign Updates"
        checked={prefs.campaign_updates}
        onChange={(v) => handleToggle('campaign_updates', v)}
      />
      <ToggleRow
        id="pref-milestone-completions"
        label="Milestone Completions"
        checked={prefs.milestone_completions}
        onChange={(v) => handleToggle('milestone_completions', v)}
      />
      <ToggleRow
        id="pref-contribution-confirmations"
        label="Contribution Confirmations"
        checked={prefs.contribution_confirmations}
        onChange={(v) => handleToggle('contribution_confirmations', v)}
      />
      <ToggleRow
        id="pref-new-recommendations"
        label="New Recommendations"
        checked={prefs.new_recommendations}
        onChange={(v) => handleToggle('new_recommendations', v)}
      />
      <ToggleRow
        id="pref-platform-announcements"
        label="Platform Announcements"
        checked={prefs.platform_announcements}
        onChange={(v) => handleToggle('platform_announcements', v)}
      />
      <ToggleRow id="pref-security-alerts" label="Security Alerts" checked={true} disabled={true} />

      {updatePrefs.isError && (
        <p
          role="alert"
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '14px',
            color: 'var(--color-status-error)',
            margin: '8px 0 0',
          }}
        >
          {updatePrefs.error instanceof Error
            ? updatePrefs.error.message
            : 'Failed to save preferences.'}
        </p>
      )}

      {successMessage !== null && (
        <output
          aria-live="polite"
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '14px',
            color: 'var(--color-status-success)',
            margin: '8px 0 0',
            display: 'block',
          }}
        >
          {successMessage}
        </output>
      )}

      <button
        type="submit"
        disabled={updatePrefs.isPending}
        style={{
          alignSelf: 'flex-start',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          minHeight: '44px',
          padding: '12px 32px',
          marginTop: '16px',
          fontFamily: 'var(--font-body)',
          fontSize: '14px',
          fontWeight: 600,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          color: 'var(--color-text-on-action)',
          background: 'var(--gradient-action-primary)',
          border: 'none',
          borderRadius: 'var(--radius-button)',
          cursor: updatePrefs.isPending ? 'not-allowed' : 'pointer',
          opacity: updatePrefs.isPending ? 0.7 : 1,
        }}
      >
        {updatePrefs.isPending ? <LoadingSpinner size="sm" label="Saving" /> : 'SAVE PREFERENCES'}
      </button>
    </form>
  );
}
