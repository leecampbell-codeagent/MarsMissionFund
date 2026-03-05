import type { ReactElement } from 'react';
import { useLocation } from 'react-router-dom';
import type { NotificationPrefs } from '../../api/account-api';
import { NotificationPrefsForm } from '../../components/account/notification-prefs-form';
import { SettingsNav } from '../../components/account/settings-nav';
import { useNotificationPrefs } from '../../hooks/account/use-notification-prefs';

/**
 * SettingsNotificationsPage — /settings/notifications
 * Notification preferences management within the settings layout.
 */
export default function SettingsNotificationsPage(): ReactElement {
  const location = useLocation();
  const { prefs, isLoading, updatePrefs, isUpdating } = useNotificationPrefs();

  const handleToggle = (key: keyof NotificationPrefs, value: boolean) => {
    if (key === 'securityAlerts') return; // Security alerts cannot be toggled
    void updatePrefs({ [key]: value });
  };

  const pageStyle: React.CSSProperties = {
    minHeight: '100vh',
    background: 'var(--color-bg-page)',
    padding: '48px 24px',
  };

  const innerStyle: React.CSSProperties = {
    maxWidth: '980px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'row',
    gap: '0',
    alignItems: 'flex-start',
  };

  const contentStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
  };

  return (
    <div style={pageStyle}>
      <div style={innerStyle}>
        <SettingsNav activeRoute={location.pathname} />
        <div style={contentStyle}>
          {/* Page header */}
          <div style={{ marginBottom: '24px' }}>
            <p
              style={{
                fontFamily: 'var(--font-data)',
                fontSize: '11px',
                fontWeight: 400,
                letterSpacing: '0.3em',
                textTransform: 'uppercase',
                color: 'var(--color-text-accent)',
                marginBottom: '8px',
                marginTop: 0,
              }}
            >
              02 — COMMS
            </p>
            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '40px',
                fontWeight: 400,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: 'var(--color-text-primary)',
                margin: 0,
              }}
            >
              NOTIFICATIONS
            </h1>
          </div>

          <NotificationPrefsForm
            prefs={prefs}
            isLoading={isLoading}
            isUpdating={isUpdating}
            onToggle={handleToggle}
          />
        </div>
      </div>
    </div>
  );
}
