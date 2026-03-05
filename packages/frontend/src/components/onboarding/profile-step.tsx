import { type ReactElement } from 'react';

interface ProfileErrors {
  readonly displayName?: string;
  readonly bio?: string;
  readonly avatarUrl?: string;
}

interface ProfileStepProps {
  readonly displayName: string;
  readonly bio: string;
  readonly avatarUrl: string;
  readonly onDisplayNameChange: (value: string) => void;
  readonly onBioChange: (value: string) => void;
  readonly onAvatarUrlChange: (value: string) => void;
  readonly errors?: ProfileErrors;
  readonly onContinue: () => void;
  readonly onSkip: () => void;
  readonly onBack: () => void;
  readonly isLoading?: boolean;
}

const BIO_MAX = 500;

export function ProfileStep({
  displayName,
  bio,
  avatarUrl,
  onDisplayNameChange,
  onBioChange,
  onAvatarUrlChange,
  errors = {},
  onContinue,
  onSkip,
  onBack,
  isLoading = false,
}: ProfileStepProps): ReactElement {
  const bioLength = bio.length;
  const bioNearLimit = bioLength >= BIO_MAX - 50;
  const bioAtLimit = bioLength >= BIO_MAX;

  return (
    <>
      <div className="profile-step">
        <h1 className="profile-step__heading">SET UP YOUR PROFILE</h1>
        <p className="profile-step__subheading">
          Tell the Mars community who you are. All fields are optional.
        </p>

        <form
          className="profile-step__form"
          onSubmit={(e) => {
            e.preventDefault();
            onContinue();
          }}
          noValidate
        >
          {/* Display Name */}
          <div className="form-field">
            <label htmlFor="display-name" className="form-label">
              DISPLAY NAME
            </label>
            <input
              type="text"
              id="display-name"
              className={`form-input${errors.displayName ? ' form-input--error' : ''}`}
              value={displayName}
              onChange={(e) => onDisplayNameChange(e.target.value)}
              placeholder="How should we call you?"
              aria-invalid={!!errors.displayName}
              aria-describedby={errors.displayName ? 'display-name-error' : undefined}
              maxLength={100}
            />
            {errors.displayName && (
              <p id="display-name-error" className="form-error">
                {errors.displayName}
              </p>
            )}
          </div>

          {/* Bio */}
          <div className="form-field">
            <label htmlFor="bio" className="form-label">
              BIO
            </label>
            <textarea
              id="bio"
              className={`form-textarea${errors.bio ? ' form-input--error' : ''}`}
              value={bio}
              onChange={(e) => onBioChange(e.target.value)}
              placeholder="Share a bit about yourself and your interest in Mars missions..."
              aria-invalid={!!errors.bio}
              aria-describedby={`bio-char-count${errors.bio ? ' bio-error' : ''}`}
              maxLength={BIO_MAX}
              rows={4}
            />
            {errors.bio && (
              <p id="bio-error" className="form-error">
                {errors.bio}
              </p>
            )}
            <p
              id="bio-char-count"
              className={`form-char-count${bioAtLimit ? ' form-char-count--error' : bioNearLimit ? ' form-char-count--warning' : ''}`}
              aria-live="polite"
            >
              {bioLength} / {BIO_MAX}
            </p>
          </div>

          {/* Avatar URL */}
          <div className="form-field">
            <label htmlFor="avatar-url" className="form-label">
              AVATAR URL
            </label>
            <input
              type="url"
              id="avatar-url"
              className={`form-input${errors.avatarUrl ? ' form-input--error' : ''}`}
              value={avatarUrl}
              onChange={(e) => onAvatarUrlChange(e.target.value)}
              placeholder="https://example.com/your-photo.jpg"
              aria-invalid={!!errors.avatarUrl}
              aria-describedby={errors.avatarUrl ? 'avatar-url-error' : undefined}
            />
            {errors.avatarUrl && (
              <p id="avatar-url-error" className="form-error">
                {errors.avatarUrl}
              </p>
            )}
          </div>

          <div className="profile-step__buttons">
            <button type="button" className="btn-ghost" onClick={onBack}>
              Back
            </button>
            <div className="profile-step__right-buttons">
              <button type="button" className="btn-secondary" onClick={onSkip}>
                Skip
              </button>
              <button
                type="submit"
                className="btn-primary"
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
        </form>
      </div>
      <style>{`
        .profile-step {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          width: 100%;
        }

        .profile-step__heading {
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
          .profile-step__heading {
            font-size: 56px;
          }
        }

        .profile-step__subheading {
          font-family: var(--font-body);
          font-size: 16px;
          font-weight: 400;
          line-height: 1.7;
          color: var(--color-text-secondary);
          margin-bottom: 32px;
        }

        .profile-step__form {
          width: 100%;
          text-align: left;
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
          font-weight: 400;
          line-height: 1.7;
          color: var(--color-text-error);
          margin-top: 6px;
        }

        .form-char-count {
          font-family: var(--font-body);
          font-size: 13px;
          font-weight: 400;
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

        .profile-step__buttons {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          margin-top: 32px;
          flex-wrap: wrap;
        }

        .profile-step__right-buttons {
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
