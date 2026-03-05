import type { ReactElement } from 'react';
import { Route, Routes } from 'react-router-dom';
import './App.css';
import { ProtectedRoute } from './components/auth/protected-route';
import { PublicOnlyRoute } from './components/auth/public-only-route';
import { LandingPlaceholder } from './components/layout/landing-placeholder';
import { PageShell } from './components/layout/page-shell';
import DashboardPlaceholder from './pages/dashboard';
import OnboardingPlaceholder from './pages/onboarding';
import SignInPage from './pages/sign-in';
import SignUpPage from './pages/sign-up';

export function App(): ReactElement {
  return (
    <PageShell>
      <Routes>
        <Route path="/" element={<LandingPlaceholder />} />
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
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPlaceholder />
            </ProtectedRoute>
          }
        />
        <Route
          path="/onboarding"
          element={
            <ProtectedRoute>
              <OnboardingPlaceholder />
            </ProtectedRoute>
          }
        />
      </Routes>
    </PageShell>
  );
}
