import { type ReactElement, lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAppAuth } from './lib/auth';
import { LoadingSpinner } from './components/ui/LoadingSpinner';

// Lazy load pages for code splitting
const SignInPage = lazy(() => import('./pages/auth/sign-in-page'));
const SignUpPage = lazy(() => import('./pages/auth/sign-up-page'));
const AuthCallbackPage = lazy(() => import('./pages/auth/callback-page'));
const OnboardingPage = lazy(() => import('./pages/account/onboarding-page'));
const SettingsProfilePage = lazy(() => import('./pages/account/settings-profile-page'));
const SettingsNotificationsPage = lazy(() => import('./pages/account/settings-notifications-page'));

// Campaign pages
const CampaignCreatePage = lazy(() => import('./pages/campaign/campaign-create-page'));
const CampaignDetailPage = lazy(() => import('./pages/campaign/campaign-detail-page'));
const MyCampaignsPage = lazy(() => import('./pages/campaign/my-campaigns-page'));
const ReviewQueuePage = lazy(() => import('./pages/campaign/review-queue-page'));

function FullPageSpinner(): ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'var(--color-bg-page)',
      }}
    >
      <LoadingSpinner size="lg" label="Loading page" />
    </div>
  );
}

interface ProtectedRouteProps {
  readonly children: ReactElement;
}

/**
 * ProtectedRoute — redirects to /sign-in if not authenticated.
 * Shows loading spinner while Clerk is initialising.
 */
function ProtectedRoute({ children }: ProtectedRouteProps): ReactElement {
  const { isLoaded, isSignedIn } = useAppAuth();

  if (!isLoaded) {
    return <FullPageSpinner />;
  }

  if (!isSignedIn) {
    return <Navigate to="/sign-in" replace />;
  }

  return children;
}

interface PublicOnlyRouteProps {
  readonly children: ReactElement;
}

/**
 * PublicOnlyRoute — redirects to / if already authenticated.
 * Used for sign-in and sign-up pages.
 */
function PublicOnlyRoute({ children }: PublicOnlyRouteProps): ReactElement {
  const { isLoaded, isSignedIn } = useAppAuth();

  if (!isLoaded) {
    return <FullPageSpinner />;
  }

  if (isSignedIn) {
    return <Navigate to="/" replace />;
  }

  return children;
}

/**
 * AppRoutes — centralised route definition with auth protection.
 */
export function AppRoutes(): ReactElement {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <Routes>
        {/* Public auth routes */}
        <Route
          path="/sign-in/*"
          element={
            <PublicOnlyRoute>
              <SignInPage />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/sign-up/*"
          element={
            <PublicOnlyRoute>
              <SignUpPage />
            </PublicOnlyRoute>
          }
        />

        {/* Protected auth callback */}
        <Route
          path="/auth/callback"
          element={
            <ProtectedRoute>
              <AuthCallbackPage />
            </ProtectedRoute>
          }
        />

        {/* Protected onboarding */}
        <Route
          path="/onboarding"
          element={
            <ProtectedRoute>
              <OnboardingPage />
            </ProtectedRoute>
          }
        />

        {/* Protected settings */}
        <Route
          path="/settings/profile"
          element={
            <ProtectedRoute>
              <SettingsProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/notifications"
          element={
            <ProtectedRoute>
              <SettingsNotificationsPage />
            </ProtectedRoute>
          }
        />

        {/* Campaign routes */}
        <Route
          path="/campaigns/new"
          element={
            <ProtectedRoute>
              <CampaignCreatePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/campaigns/:id/edit"
          element={
            <ProtectedRoute>
              <CampaignCreatePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/campaigns/:id"
          element={
            <ProtectedRoute>
              <CampaignDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/me/campaigns"
          element={
            <ProtectedRoute>
              <MyCampaignsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/review-queue"
          element={
            <ProtectedRoute>
              <ReviewQueuePage />
            </ProtectedRoute>
          }
        />

        {/* Default redirect */}
        <Route path="/settings" element={<Navigate to="/settings/profile" replace />} />

        {/* 404 — placeholder for now */}
        <Route
          path="*"
          element={
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100vh',
                background: 'var(--color-bg-page)',
                textAlign: 'center',
                padding: '24px',
              }}
            >
              <h1
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '56px',
                  color: 'var(--color-text-primary)',
                  marginBottom: '16px',
                }}
              >
                404
              </h1>
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '16px',
                  color: 'var(--color-text-secondary)',
                }}
              >
                This page doesn&apos;t exist. Return to{' '}
                <a href="/" style={{ color: 'var(--color-action-primary)' }}>
                  home
                </a>
                .
              </p>
            </div>
          }
        />
      </Routes>
    </Suspense>
  );
}

























