import { type ReactElement, useEffect, useRef } from 'react';
import type { NotificationPrefs } from '../../../api/account-api';
import { LoadingSpinner } from '../../ui/LoadingSpinner';
import { NotificationToggleRow } from '../notification-toggle-row/notification-toggle-row';

interface NotificationPrefsFormProps {
  readonly prefs: NotificationPrefs | null;
  readonly isLoading?: boolean;
  readonly isUpdating?: boolean;
  readonly onToggle: (key: keyof NotificationPrefs, value: boolean) => void;
}

interface PrefRowConfig {
  readonly key: keyof NotificationPrefs;
  readonly label: string;
  readonly description: string;
  readonly locked: boolean;
}

const PREF_ROWS: PrefRowConfig[] = [
  {
    key: 'campaignUpdates',
    label: 'Campaign Updates',
    description: "News from missions you're backing.",
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
    description: "Missions we think you'll want to back.",
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

function SkeletonRow({ isLast }: { readonly isLast: boolean }): ReactElement {
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
      <div
        style={{
          width: '200px',
          height: '40px',
          background: 'var(--color-bg-elevated)',
          borderRadius: '4px',
          animation: 'skeletonPulse 2s ease-in-out infinite',
        }}
      />
      <div
        style={{
          width: '44px',
          height: '24px',
          background: 'var(--color-bg-elevated)',
          borderRadius: 'var(--radius-full)',
          animation: 'skeletonPulse 2s ease-in-out infinite',
        }}
      />
    </div>
  );
}

/**
 * NotificationPrefsForm — full notification preferences form for the settings page.
 * Changes are saved immediately on toggle.
 */
export function NotificationPrefsForm({
  prefs,
  isLoading = false,
  isUpdating = false,
  onToggle,
}: NotificationPrefsFormProps): ReactElement {
  const prevUpdating = useRef(isUpdating);
  const announcerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (prevUpdating.current && !isUpdating && announcerRef.current) {
      announcerRef.current.textContent = 'Preferences updated';
      setTimeout(() => {
        if (announcerRef.current) {
          announcerRef.current.textContent = '';
        }
      }, 2000);
    }
    prevUpdating.current = isUpdating;
  }, [isUpdating]);

  const cardStyle: React.CSSProperties = {
    background: 'var(--color-bg-surface)',
    border: '1px solid var(--color-border-subtle)',
    borderRadius: 'var(--radius-card)',
    padding: '32px',
    position: 'relative',
    overflow: 'hidden',
  };

  const topAccentStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '2px',
    background: 'linear-gradient(90deg, var(--color-border-accent), var(--color-status-warning))',
  };

  return (
    <div style={cardStyle}>
      <style>{`
        @keyframes skeletonPulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes skeletonPulse {
            0%, 100% { opacity: 0.7; }
          }
        }
      `}</style>
      <div style={topAccentStyle} />

      {/* Header with saving indicator */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '24px',
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              marginBottom: '8px',
              marginTop: 0,
            }}
          >
            Notification Preferences
          </h2>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '13px',
              color: 'var(--color-text-secondary)',
              marginBottom: '24px',
              marginTop: 0,
            }}
          >
            Security alerts are always enabled to protect your account.
          </p>
        </div>
        {isUpdating && (
          <div style={{ position: 'absolute', top: '36px', right: '32px' }}>
            <LoadingSpinner size="sm" color="muted" label="Saving preferences" />
          </div>
        )}
      </div>

      {/* Live region for save confirmation */}
      <span
        ref={announcerRef}
        aria-live="polite"
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          overflow: 'hidden',
          clip: 'rect(0,0,0,0)',
          whiteSpace: 'nowrap',
        }}
      />

      <fieldset aria-busy={isLoading} style={{ border: 'none', padding: 0, margin: 0 }}>
        <legend
          style={{
            position: 'absolute',
            width: '1px',
            height: '1px',
            overflow: 'hidden',
            clip: 'rect(0,0,0,0)',
            whiteSpace: 'nowrap',
          }}
        >
          Notification preferences
        </legend>

        {isLoading || !prefs
          ? PREF_ROWS.map((row, index) => (
              <SkeletonRow key={row.key} isLast={index === PREF_ROWS.length - 1} />
            ))
          : PREF_ROWS.map((row, index) => (
              <NotificationToggleRow
                key={row.key}
                id={row.key}
                label={row.label}
                description={row.description}
                checked={prefs[row.key] as boolean}
                locked={row.locked}
                onChange={(value) => onToggle(row.key, value)}
                isLast={index === PREF_ROWS.length - 1}
              />
            ))}
      </fieldset>
    </div>
  );
}
