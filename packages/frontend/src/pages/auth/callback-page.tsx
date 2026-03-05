import { type ReactElement, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { syncUser } from '../../api/account-api';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Button } from '../../components/ui/Button';

/**
 * AuthCallbackPage — /auth/callback
 * Calls POST /api/v1/auth/sync after Clerk sign-in.
 * Redirects to /onboarding if onboardingCompleted === false, else to /.
 */
export default function AuthCallbackPage(): ReactElement {
  const navigate = useNavigate();

  const mutation = useMutation({
    mutationFn: syncUser,
    onSuccess: (user) => {
      if (!user.onboardingCompleted) {
        void navigate('/onboarding', { replace: true });
      } else {
        void navigate('/', { replace: true });
      }
    },
  });

  useEffect(() => {
    mutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRetry = () => {
    mutation.mutate();
  };

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    background: 'var(--color-bg-page)',
    padding: '24px',
  };

  const contentStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    maxWidth: '320px',
    textAlign: 'center',
  };

  if (mutation.isError) {
    return (
      <div style={containerStyle}>
        <div style={contentStyle}>
          {/* Coin icon mark */}
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'var(--gradient-action-primary)',
              marginBottom: '24px',
            }}
            aria-hidden="true"
          />
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '16px',
              color: 'var(--color-text-primary)',
              marginBottom: '8px',
              marginTop: 0,
            }}
          >
            Something went wrong on our end.
          </p>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '13px',
              color: 'var(--color-text-secondary)',
              marginBottom: '24px',
              marginTop: 0,
              lineHeight: 1.7,
            }}
          >
            We&apos;re looking into it. Try again in a few minutes.
          </p>
          <Button variant="secondary" onClick={handleRetry} type="button">
            Try again →
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={contentStyle}>
        {/* Coin icon mark */}
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: 'var(--gradient-action-primary)',
            marginBottom: '24px',
          }}
          aria-hidden="true"
        />
        <LoadingSpinner size="md" color="primary" label="Syncing your profile" />
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '16px',
            color: 'var(--color-text-secondary)',
            marginTop: '16px',
            marginBottom: 0,
          }}
        >
          Preparing your mission profile…
        </p>
      </div>
    </div>
  );
}




























