import { type ReactElement, useEffect, useId, useState } from 'react';
import type { UserProfile } from '../../../api/account-api';
import { Button } from '../../ui/Button';

interface ProfileEditFormProps {
  readonly user: UserProfile;
  readonly onSave: (data: { displayName: string; bio: string }) => void;
  readonly isSaving?: boolean;
  readonly isSuccess?: boolean;
  readonly error?: string | null;
}

const DISPLAY_NAME_MAX = 255;
const BIO_MAX = 500;
const BIO_WARNING_THRESHOLD = 450;

/**
 * ProfileEditForm — inline profile editing on the settings page.
 * Implements design spec ProfileEditForm component.
 */
export function ProfileEditForm({
  user,
  onSave,
  isSaving = false,
  isSuccess = false,
  error = null,
}: ProfileEditFormProps): ReactElement {
  const [displayName, setDisplayName] = useState(user.displayName ?? '');
  const [bio, setBio] = useState(user.bio ?? '');
  const [displayNameError, setDisplayNameError] = useState<string | null>(null);
  const [bioError, setBioError] = useState<string | null>(null);

  const displayNameId = useId();
  const bioId = useId();
  const displayNameErrorId = useId();
  const bioErrorId = useId();

  // Reset form when user data changes externally
  useEffect(() => {
    setDisplayName(user.displayName ?? '');
    setBio(user.bio ?? '');
  }, [user.displayName, user.bio]);

  const validateDisplayName = (value: string): string | null => {
    if (value.length > DISPLAY_NAME_MAX) {
      return `Display name must be ${DISPLAY_NAME_MAX} characters or fewer.`;
    }
    return null;
  };

  const validateBio = (value: string): string | null => {
    if (value.length > BIO_MAX) {
      return `Bio must be ${BIO_MAX} characters or fewer.`;
    }
    return null;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const dnErr = validateDisplayName(displayName);
    const bioErr = validateBio(bio);
    setDisplayNameError(dnErr);
    setBioError(bioErr);
    if (dnErr || bioErr) return;
    onSave({ displayName, bio });
  };

  const bioCount = bio.length;
  const bioCountColor =
    bioCount > BIO_MAX
      ? 'var(--color-text-error)'
      : bioCount > BIO_WARNING_THRESHOLD
        ? 'var(--color-text-error)'
        : 'var(--color-text-tertiary)';

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

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'var(--color-bg-input)',
    border: '1px solid var(--color-border-input)',
    borderRadius: 'var(--radius-input)',
    color: 'var(--color-text-primary)',
    fontFamily: 'var(--font-body)',
    fontSize: '16px',
    padding: '14px 16px',
    boxSizing: 'border-box',
    outline: 'none',
  };

  const labelStyle: React.CSSProperties = {
    fontFamily: 'var(--font-data)',
    fontSize: '12px',
    fontWeight: 600,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    color: 'var(--color-text-tertiary)',
    display: 'block',
    marginBottom: '8px',
  };

  let saveButtonLabel = 'Save changes';
  let saveButtonVariant: 'primary' | 'success' = 'primary';
  if (isSaving) {
    saveButtonLabel = 'Saving…';
  } else if (isSuccess) {
    saveButtonLabel = 'Saved';
    saveButtonVariant = 'success';
  }

  return (
    <div style={cardStyle}>
      <div style={topAccentStyle} />
      <h2
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '24px',
          fontWeight: 700,
          color: 'var(--color-text-primary)',
          marginBottom: '24px',
          marginTop: 0,
        }}
      >
        Edit Profile
      </h2>

      <form onSubmit={handleSubmit} aria-label="Edit profile">
        {/* Display Name */}
        <div style={{ marginBottom: '24px' }}>
          <label htmlFor={displayNameId} style={labelStyle}>
            DISPLAY NAME
          </label>
          <input
            id={displayNameId}
            type="text"
            value={displayName}
            onChange={(e) => {
              setDisplayName(e.target.value);
              setDisplayNameError(validateDisplayName(e.target.value));
            }}
            placeholder="Ada Lovelace"
            style={{
              ...inputStyle,
              borderColor: displayNameError ? 'var(--color-status-error)' : undefined,
            }}
            aria-describedby={displayNameError ? displayNameErrorId : undefined}
          />
          {displayNameError && (
            <p
              id={displayNameErrorId}
              role="alert"
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '13px',
                color: 'var(--color-text-error)',
                marginTop: '6px',
                marginBottom: 0,
              }}
            >
              {displayNameError}
            </p>
          )}
        </div>

        {/* Bio */}
        <div style={{ marginBottom: '32px' }}>
          <label htmlFor={bioId} style={labelStyle}>
            BIO
          </label>
          <textarea
            id={bioId}
            value={bio}
            onChange={(e) => {
              setBio(e.target.value);
              setBioError(validateBio(e.target.value));
            }}
            placeholder="Mars enthusiast and propulsion engineer…"
            style={{
              ...inputStyle,
              minHeight: '120px',
              resize: 'vertical',
              borderColor: bioError ? 'var(--color-status-error)' : undefined,
            }}
            aria-describedby={bioError ? bioErrorId : undefined}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
            {bioError && (
              <p
                id={bioErrorId}
                role="alert"
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '13px',
                  color: 'var(--color-text-error)',
                  margin: 0,
                }}
              >
                {bioError}
              </p>
            )}
            <span style={{ flex: 1 }} />
            <span
              style={{
                fontFamily: 'var(--font-data)',
                fontSize: '11px',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: bioCountColor,
              }}
            >
              {bioCount} / {BIO_MAX}
            </span>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div
            role="alert"
            aria-live="assertive"
            style={{
              background: 'rgba(193, 68, 14, 0.12)',
              border: '1px solid rgba(193, 68, 14, 0.2)',
              borderRadius: 'var(--radius-badge)',
              padding: '12px 16px',
              marginBottom: '16px',
            }}
          >
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '13px',
                color: 'var(--color-text-error)',
                margin: 0,
              }}
            >
              {error}
            </p>
          </div>
        )}

        <Button
          variant={saveButtonVariant}
          type="submit"
          isLoading={isSaving}
          disabled={isSaving}
          aria-disabled={isSaving}
        >
          <span
            role={isSuccess ? 'status' : undefined}
            aria-live={isSuccess ? 'polite' : undefined}
          >
            {saveButtonLabel}
          </span>
        </Button>
      </form>
    </div>
  );
}
