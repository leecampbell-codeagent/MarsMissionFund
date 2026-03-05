import { type ReactElement, useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useAccount } from '../hooks/account/use-account';
import { useUpdateProfile } from '../hooks/account/use-update-profile';

export default function ProfileSettingsPage(): ReactElement {
  const { isLoaded } = useAuth();
  const { data: account, isLoading } = useAccount();
  const updateProfile = useUpdateProfile();

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [errors, setErrors] = useState<{
    displayName?: string;
    avatarUrl?: string;
    bio?: string;
  }>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pre-populate form from account data
  useEffect(() => {
    if (account) {
      setDisplayName(account.display_name ?? '');
      setBio(account.bio ?? '');
      setAvatarUrl(account.avatar_url ?? '');
    }
  }, [account]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  function validate(): boolean {
    const errs: { displayName?: string; avatarUrl?: string } = {};
    if (displayName.trim().length > 100) {
      errs.displayName = 'Display name must be 100 characters or fewer.';
    }
    if (avatarUrl.trim() && !avatarUrl.trim().startsWith('https://')) {
      errs.avatarUrl = 'Avatar URL must start with https://';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSave(): Promise<void> {
    if (!validate()) return;
    setSaveError(null);
    setSuccessMessage(null);
    try {
      await updateProfile.mutateAsync({
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
        avatar_url: avatarUrl.trim() || null,
      });
      setSuccessMessage('Profile updated successfully.');
      successTimerRef.current = setTimeout(() => setSuccessMessage(null), 5000);
    } catch {
      setSaveError("We couldn't save your changes. Try again.");
    }
  }

  const hasChanges =
    displayName !== (account?.display_name ?? '') ||
    bio !== (account?.bio ?? '') ||
    avatarUrl !== (account?.avatar_url ?? '');

  const BIO_MAX = 500;
  const bioLength = bio.length;
  const bioNearLimit = bioLength >= BIO_MAX - 50;
  const bioAtLimit = bioLength >= BIO_MAX;

  if (isLoading || !isLoaded) {
    return (
      <div className="settings-page">
        <div className="settings-page__content">
          <div className="skeleton skeleton--label" />
          <div className="skeleton skeleton--heading" />
          <div className="skeleton skeleton--input" />
          <div className="skeleton skeleton--input" />
          <div className="skeleton skeleton--textarea" />
          <div className="skeleton skeleton--input" />
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
          .skeleton--input { height: 48px; width: 100%; margin-bottom: 24px; }
          .skeleton--textarea { height: 120px; width: 100%; margin-bottom: 24px; }
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
          <p className="settings-page__section-label">01 — PROFILE</p>
          <h1 className="settings-page__heading">YOUR PROFILE</h1>

          {successMessage && (
            <div className="settings-page__success" role="status" aria-live="polite">
              {successMessage}
            </div>
          )}

          {saveError && (
            <div className="settings-page__save-error" role="alert">
              {saveError}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSave();
            }}
            noValidate
          >
            {/* Email (read-only) */}
            <div className="form-field">
              <p className="form-label">EMAIL</p>
              <div className="form-readonly" aria-label="Email address">
                {account?.email ?? '—'}
              </div>
              <p className="form-helper">Email is managed through your Clerk account settings.</p>
            </div>

            {/* Display Name */}
            <div className="form-field">
              <label htmlFor="profile-display-name" className="form-label">
                DISPLAY NAME
              </label>
              <input
                type="text"
                id="profile-display-name"
                className={`form-input${errors.displayName ? ' form-input--error' : ''}`}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="How should we call you?"
                aria-invalid={!!errors.displayName}
                aria-describedby={errors.displayName ? 'profile-display-name-error' : undefined}
                maxLength={100}
              />
              {errors.displayName && (
                <p id="profile-display-name-error" className="form-error">
                  {errors.displayName}
                </p>
              )}
            </div>

            {/* Bio */}
            <div className="form-field">
              <label htmlFor="profile-bio" className="form-label">
                BIO
              </label>
              <textarea
                id="profile-bio"
                className={`form-textarea${errors.bio ? ' form-input--error' : ''}`}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Share a bit about yourself and your interest in Mars missions..."
                aria-invalid={!!errors.bio}
                aria-describedby={`profile-bio-char-count${errors.bio ? ' profile-bio-error' : ''}`}
                maxLength={BIO_MAX}
                rows={4}
              />
              {errors.bio && (
                <p id="profile-bio-error" className="form-error">
                  {errors.bio}
                </p>
              )}
              <p
                id="profile-bio-char-count"
                className={`form-char-count${bioAtLimit ? ' form-char-count--error' : bioNearLimit ? ' form-char-count--warning' : ''}`}
                aria-live="polite"
              >
                {bioLength} / {BIO_MAX}
              </p>
            </div>

            {/* Avatar URL */}
            <div className="form-field">
              <label htmlFor="profile-avatar-url" className="form-label">
                AVATAR URL
              </label>
              <input
                type="url"
                id="profile-avatar-url"
                className={`form-input${errors.avatarUrl ? ' form-input--error' : ''}`}
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://example.com/your-photo.jpg"
                aria-invalid={!!errors.avatarUrl}
                aria-describedby={errors.avatarUrl ? 'profile-avatar-url-error' : undefined}
              />
              {errors.avatarUrl && (
                <p id="profile-avatar-url-error" className="form-error">
                  {errors.avatarUrl}
                </p>
              )}
            </div>

            <div className="settings-page__button-row">
              <button
                type="submit"
                className="btn-primary"
                disabled={updateProfile.isPending || !hasChanges}
                aria-busy={updateProfile.isPending}
              >
                {updateProfile.isPending ? (
                  <>
                    <span className="btn-spinner" aria-hidden="true" />
                    <span>Saving...</span>
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
      <style>{`
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
          font-weight: 400;
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

        .form-field {
          margin-bottom: 24px;
        }

        .form-label {
          display: block;
          font-family: var(--font-data);
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: var(--color-text-tertiary);
          margin-bottom: 8px;
        }

        .form-readonly {
          font-family: var(--font-body);
          font-size: 16px;
          font-weight: 400;
          color: var(--color-text-primary);
          padding: 4px 0;
        }

        .form-helper {
          font-family: var(--font-body);
          font-size: 13px;
          color: var(--color-text-tertiary);
          margin-top: 4px;
        }

        .form-input,
        .form-textarea {
          width: 100%;
          background: var(--color-bg-input);
          border: 1px solid var(--color-border-input);
          border-radius: var(--radius-input);
          padding: 14px 16px;
          font-family: var(--font-body);
          font-size: 16px;
          font-weight: 400;
          color: var(--color-text-primary);
          box-sizing: border-box;
          transition:
            border-color var(--motion-hover-duration) var(--motion-hover-easing),
            box-shadow var(--motion-hover-duration) var(--motion-hover-easing);
        }

        .form-input::placeholder,
        .form-textarea::placeholder {
          color: var(--color-text-tertiary);
        }

        .form-input:focus,
        .form-textarea:focus {
          outline: none;
          border-color: var(--color-border-emphasis);
          box-shadow: 0 0 0 3px rgba(255, 92, 26, 0.25);
        }

        .form-input--error {
          border-color: var(--color-status-error);
        }

        .form-textarea {
          min-height: 120px;
          resize: vertical;
        }

        @media (max-width: 767px) {
          .form-textarea {
            min-height: 100px;
          }
        }

        .form-error {
          font-family: var(--font-body);
          font-size: 13px;
          color: var(--color-text-error);
          margin-top: 6px;
        }

        .form-char-count {
          font-family: var(--font-body);
          font-size: 13px;
          color: var(--color-text-tertiary);
          text-align: right;
          margin-top: 4px;
        }

        .form-char-count--warning {
          color: var(--color-text-warning);
        }

        .form-char-count--error {
          color: var(--color-text-error);
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
