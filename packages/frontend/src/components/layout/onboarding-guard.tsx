import { Navigate } from 'react-router-dom';
import { useCurrentUser } from '../../hooks/use-current-user.js';
import { LoadingSpinner } from '../ui/loading-spinner.js';

interface OnboardingGuardProps {
  readonly children: React.ReactNode;
}

export function OnboardingGuard({ children }: OnboardingGuardProps) {
  const { data, isLoading, isError } = useCurrentUser();

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
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

  if (isError) {
    return <>{children}</>;
  }

  if (data?.data.onboardingCompleted === false) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
