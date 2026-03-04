import { type ReactElement, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { AuthLoadingScreen } from './auth-loading-screen';

interface PublicOnlyRouteProps {
  readonly children: ReactNode;
}

/**
 * Route wrapper that redirects authenticated users to /dashboard.
 * Shows a loading screen while Clerk initialises.
 */
export function PublicOnlyRoute({ children }: PublicOnlyRouteProps): ReactElement {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return <AuthLoadingScreen />;
  }

  if (isSignedIn) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
