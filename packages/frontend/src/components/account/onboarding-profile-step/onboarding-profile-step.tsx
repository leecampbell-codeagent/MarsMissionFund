import { type ReactElement, useId, useState } from 'react';
import { Button } from '../../ui/Button';

interface OnboardingProfileStepProps {
  readonly onNext: (data: { displayName: string; bio: string }) => void;
  readonly onBack: () => void;
  readonly onSkip: () => void;
  readonly isSaving?: boolean;
  readonly initialValues?: { readonly displayName: string | null; readonly bio: string | null };
  readonly error?: string | null;
}

const DISPLAY_NAME_MAX = 255;
const BIO_MAX = 500;
const BIO_WARNING_THRESHOLD = 450;

/**
 * OnboardingProfileStep — Step 3 of the onboarding flow.
 * Display name and bio input form. Skippable.
 */
export function OnboardingProfileStep({
  onNext,
  onBack,
  onSkip,
  isSaving = false,
  initialValues = { displayName: null, bio: null },
  error = null,
}: OnboardingProfileStepProps): ReactElement {
  const [displayName, setDisplayName] = useState(initialValues.displayName ?? '');
  const [bio, setBio] = useState(initialValues.bio ?? '');
  const [displayNameError, setDisplayNameError] = useState<string | null>(null);
  const [bioError, setBioError] = useState<string | null>(null);

  const displayNameId = useId();
  const bioId = useId();
  const displayNameErrorId = useId();
  const bioErrorId = useId();
  const bioCountId = useId();

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
    onNext({ displayName, bio });
  };

  const bioCount = bio.length;
  const bioCountColor =
    bioCount > BIO_MAX
      ? 'var(--color-text-error)'
      : bioCount > BIO_WARNING_THRESHOLD
        ? 'var(--color-text-error)'
        : 'var(--color-text-tertiary)';

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
        03 — YOUR PROFILE
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
        TELL US ABOUT YOURSELF.
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
        Your profile appears on campaigns you back and missions you create. You can always update it
        later.
      </p>

      <form onSubmit={handleSubmit}>
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
            maxLength={DISPLAY_NAME_MAX + 10}
          />
          {displayNameError ? (
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
          ) : (
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '13px',
                color: 'var(--color-text-tertiary)',
                marginTop: '6px',
                marginBottom: 0,
              }}
            >
              Up to {DISPLAY_NAME_MAX} characters
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
            aria-describedby={`${bioErrorId} ${bioCountId}`}
          />
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: '6px',
            }}
          >
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
              id={bioCountId}
              aria-live="polite"
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

        {/* API error banner */}
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

        {/* CTA row */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '16px',
            flexWrap: 'wrap',
          }}
        >
          <Button variant="ghost" onClick={onBack} type="button">
            Back
          </Button>
          <Button
            variant="ghost"
            onClick={onSkip}
            type="button"
            aria-label="Skip profile setup for now"
          >
            Skip for now
          </Button>
          <Button variant="primary" type="submit" isLoading={isSaving} disabled={isSaving}>
            {isSaving ? 'Saving…' : 'Save and continue →'}
          </Button>
        </div>
      </form>
    </div>
  );
}
