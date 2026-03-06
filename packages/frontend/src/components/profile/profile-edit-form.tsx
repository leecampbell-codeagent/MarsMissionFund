import { useState } from 'react';
import { useUpdateProfile } from '../../hooks/use-update-profile.js';
import { LoadingSpinner } from '../ui/loading-spinner.js';

interface ProfileEditFormProps {
  readonly initialDisplayName: string | null;
  readonly initialBio: string | null;
}

export function ProfileEditForm({ initialDisplayName, initialBio }: ProfileEditFormProps) {
  const [displayName, setDisplayName] = useState(initialDisplayName ?? '');
  const [bio, setBio] = useState(initialBio ?? '');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const updateProfile = useUpdateProfile();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = displayName.trim();
    if (trimmedName.length === 0 && displayName.length > 0) {
      return;
    }

    setSuccessMessage(null);

    updateProfile.mutate(
      {
        displayName: trimmedName.length > 0 ? trimmedName : null,
        bio: bio.trim().length > 0 ? bio.trim() : null,
      },
      {
        onSuccess: () => {
          setSuccessMessage('Profile updated successfully.');
        },
      },
    );
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <label
          htmlFor="profile-display-name"
          style={{
            fontFamily: 'var(--font-data)',
            fontSize: '11px',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: 'var(--color-text-tertiary)',
          }}
        >
          Display Name
        </label>
        <input
          id="profile-display-name"
          type="text"
          value={displayName}
          onChange={(e) => {
            setDisplayName(e.target.value);
            setSuccessMessage(null);
          }}
          maxLength={100}
          placeholder="Your name"
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '16px',
            color: 'var(--color-text-primary)',
            backgroundColor: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 'var(--radius-input)',
            padding: '12px 16px',
            outline: 'none',
            width: '100%',
            boxSizing: 'border-box',
          }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <label
          htmlFor="profile-bio"
          style={{
            fontFamily: 'var(--font-data)',
            fontSize: '11px',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: 'var(--color-text-tertiary)',
          }}
        >
          Bio
        </label>
        <textarea
          id="profile-bio"
          value={bio}
          onChange={(e) => {
            setBio(e.target.value);
            setSuccessMessage(null);
          }}
          maxLength={500}
          rows={4}
          placeholder="Tell us about yourself"
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '16px',
            color: 'var(--color-text-primary)',
            backgroundColor: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 'var(--radius-input)',
            padding: '12px 16px',
            outline: 'none',
            width: '100%',
            boxSizing: 'border-box',
            resize: 'vertical',
          }}
        />
        <p
          style={{
            fontFamily: 'var(--font-data)',
            fontSize: '11px',
            color: 'var(--color-text-tertiary)',
            margin: 0,
            textAlign: 'right',
          }}
        >
          {bio.length}/500
        </p>
      </div>

      {updateProfile.isError && (
        <p
          role="alert"
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '14px',
            color: 'var(--color-status-error)',
            margin: 0,
          }}
        >
          {updateProfile.error instanceof Error
            ? updateProfile.error.message
            : 'Failed to update profile.'}
        </p>
      )}

      {successMessage !== null && (
        <output
          aria-live="polite"
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '14px',
            color: 'var(--color-status-success)',
            margin: 0,
            display: 'block',
          }}
        >
          {successMessage}
        </output>
      )}

      <button
        type="submit"
        disabled={updateProfile.isPending}
        style={{
          alignSelf: 'flex-start',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          minHeight: '44px',
          padding: '12px 32px',
          fontFamily: 'var(--font-body)',
          fontSize: '14px',
          fontWeight: 600,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          color: 'var(--color-text-on-action)',
          background: 'var(--gradient-action-primary)',
          border: 'none',
          borderRadius: 'var(--radius-button)',
          cursor: updateProfile.isPending ? 'not-allowed' : 'pointer',
          opacity: updateProfile.isPending ? 0.7 : 1,
        }}
      >
        {updateProfile.isPending ? <LoadingSpinner size="sm" label="Saving" /> : 'SAVE CHANGES'}
      </button>
    </form>
  );
}
