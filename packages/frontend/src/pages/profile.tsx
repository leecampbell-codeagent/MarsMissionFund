import { NotificationPreferencesForm } from '../components/profile/notification-preferences-form.js';
import { ProfileEditForm } from '../components/profile/profile-edit-form.js';
import { LoadingSpinner } from '../components/ui/loading-spinner.js';
import { useCurrentUser } from '../hooks/use-current-user.js';

export default function ProfilePage() {
  const { data, isLoading, isError, refetch } = useCurrentUser();

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: 'calc(100vh - 64px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--color-bg-page)',
        }}
      >
        <LoadingSpinner />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div
        style={{
          minHeight: 'calc(100vh - 64px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--color-bg-page)',
          gap: '16px',
        }}
      >
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '16px',
            color: 'var(--color-text-secondary)',
            margin: 0,
          }}
        >
          Failed to load profile. Please try again.
        </p>
        <button
          type="button"
          onClick={() => void refetch()}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '44px',
            padding: '12px 24px',
            fontFamily: 'var(--font-body)',
            fontSize: '14px',
            fontWeight: 600,
            color: 'var(--color-action-ghost-text)',
            backgroundColor: 'transparent',
            border: '1px solid var(--color-action-ghost-border)',
            borderRadius: 'var(--radius-button)',
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  const user = data.data;
  const displayName = user.displayName ?? user.email;

  return (
    <>
      <title>Profile — Mars Mission Fund</title>
      <div
        style={{
          minHeight: 'calc(100vh - 64px)',
          backgroundColor: 'var(--color-bg-page)',
          padding: '48px 24px',
        }}
      >
        <div
          style={{
            maxWidth: '640px',
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '48px',
          }}
        >
          {/* Section label */}
          <p
            style={{
              fontFamily: 'var(--font-data)',
              fontSize: '11px',
              fontWeight: 400,
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              color: 'var(--color-text-accent)',
              margin: 0,
            }}
          >
            YOUR ACCOUNT
          </p>

          {/* Profile Header */}
          <section aria-label="Profile header">
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '16px' }}
            >
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={`${displayName}'s avatar`}
                  style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '50%',
                    objectFit: 'cover',
                  }}
                />
              ) : (
                <div
                  role="img"
                  aria-label="Avatar placeholder"
                  style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--color-bg-surface)',
                    border: '1px solid var(--color-border-subtle)',
                  }}
                />
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <h1
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '32px',
                    fontWeight: 400,
                    letterSpacing: '0.04em',
                    color: 'var(--color-text-primary)',
                    lineHeight: 1,
                    margin: 0,
                    textTransform: 'uppercase',
                  }}
                >
                  {displayName}
                </h1>

                <p
                  style={{
                    fontFamily: 'var(--font-data)',
                    fontSize: '13px',
                    color: 'var(--color-text-tertiary)',
                    margin: 0,
                  }}
                >
                  {user.email}
                </p>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                  {/* Account status badge */}
                  <span
                    style={{
                      fontFamily: 'var(--font-data)',
                      fontSize: '11px',
                      letterSpacing: '0.15em',
                      textTransform: 'uppercase',
                      color: 'var(--color-status-success)',
                      backgroundColor: 'var(--color-bg-surface)',
                      border: '1px solid var(--color-status-success)',
                      borderRadius: '4px',
                      padding: '2px 8px',
                    }}
                  >
                    {user.accountStatus}
                  </span>

                  {/* Role badges */}
                  {user.roles.map((role) => (
                    <span
                      key={role}
                      style={{
                        fontFamily: 'var(--font-data)',
                        fontSize: '11px',
                        letterSpacing: '0.15em',
                        textTransform: 'uppercase',
                        color: 'var(--color-text-accent)',
                        backgroundColor: 'var(--color-bg-surface)',
                        border: '1px solid var(--color-border-subtle)',
                        borderRadius: '4px',
                        padding: '2px 8px',
                      }}
                    >
                      {role}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Edit Profile section */}
          <section aria-label="Edit profile">
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '24px',
                fontWeight: 400,
                letterSpacing: '0.04em',
                color: 'var(--color-text-primary)',
                textTransform: 'uppercase',
                margin: '0 0 24px 0',
              }}
            >
              EDIT PROFILE
            </h2>
            <ProfileEditForm initialDisplayName={user.displayName} initialBio={user.bio} />
          </section>

          {/* Notification Preferences section */}
          <section aria-label="Notification preferences">
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '24px',
                fontWeight: 400,
                letterSpacing: '0.04em',
                color: 'var(--color-text-primary)',
                textTransform: 'uppercase',
                margin: '0 0 24px 0',
              }}
            >
              NOTIFICATION PREFERENCES
            </h2>
            <NotificationPreferencesForm initialPreferences={user.notificationPreferences} />
          </section>
        </div>
      </div>
    </>
  );
}
