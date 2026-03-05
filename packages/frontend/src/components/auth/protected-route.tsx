import { useAuth } from '@clerk/clerk-react';
import type { ReactElement, ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthLoadingScreen } from './auth-loading-screen';

interface ProtectedRouteProps {
  readonly children: ReactNode;
}

/**
 * Route wrapper that redirects unauthenticated users to /sign-in.
 * Shows a loading screen while Clerk initialises.
 */
export function ProtectedRoute({ children }: ProtectedRouteProps): ReactElement {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return <AuthLoadingScreen />;
  }

  if (!isSignedIn) {
    return <Navigate to="/sign-in" replace />;
  }

  return <>{children}</>;
}
