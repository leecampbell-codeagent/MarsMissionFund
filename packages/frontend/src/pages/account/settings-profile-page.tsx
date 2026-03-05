import { type ReactElement, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateProfile } from '../../api/account-api';
import { useCurrentUser, CURRENT_USER_QUERY_KEY } from '../../hooks/account/use-current-user';
import { useKycStatus } from '../../hooks/account/use-kyc-status';
import { SettingsNav } from '../../components/account/settings-nav';
import { ProfileCard } from '../../components/account/profile-card';
import { ProfileEditForm } from '../../components/account/profile-edit-form';
import { KycVerificationPanel } from '../../components/account/kyc-verification-panel';

/**
 * SettingsProfilePage — /settings/profile
 * Profile viewing and editing within the settings layout.
 */
export default function SettingsProfilePage(): ReactElement {
  const location = useLocation();
  const queryClient = useQueryClient();
  const { user, isLoading, isError } = useCurrentUser();
  const { kycStatus, isLoading: isKycLoading, isError: isKycError, error: kycError } = useKycStatus();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const mutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CURRENT_USER_QUERY_KEY });
      setSaveError(null);
      setIsSuccess(true);
    },
    onError: () => {
      setSaveError("We couldn't save your changes. Try again.");
      setIsSuccess(false);
    },
  });

  // Reset success state after 2 seconds
  useEffect(() => {
    if (isSuccess) {
      const timer = setTimeout(() => setIsSuccess(false), 2000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isSuccess]);

  const handleSave = (data: { displayName: string; bio: string }) => {
    mutation.mutate({
      displayName: data.displayName || null,
      bio: data.bio || null,
    });
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
              01 — PROFILE
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
              YOUR PROFILE
            </h1>
          </div>

          {/* Profile card */}
          <div style={{ marginBottom: '24px' }}>
            <ProfileCard user={user} isLoading={isLoading} isError={isError} />
          </div>

          {/* Edit form — only when user is loaded */}
          {user && (
            <ProfileEditForm
              user={user}
              onSave={handleSave}
              isSaving={mutation.isPending}
              isSuccess={isSuccess}
              error={saveError}
            />
          )}

          {/* Identity verification section */}
          <div style={{ marginTop: '24px' }}>
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
              04 — IDENTITY VERIFICATION
            </p>
            <section aria-labelledby="kyc-section-label">
              <span id="kyc-section-label" style={{ display: 'none' }}>
                Identity Verification
              </span>
              <KycVerificationPanel
                kycStatus={kycStatus?.kycStatus}
                isLoading={isKycLoading}
                error={isKycError ? kycError : null}
              />
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}






















