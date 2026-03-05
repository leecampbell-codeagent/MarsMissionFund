import type { ReactElement } from 'react';
import { Route, Routes } from 'react-router-dom';
import './App.css';
import { ProtectedRoute } from './components/auth/protected-route';
import { PublicOnlyRoute } from './components/auth/public-only-route';
import { LandingPlaceholder } from './components/layout/landing-placeholder';
import { PageShell } from './components/layout/page-shell';
import ReviewQueuePage from './pages/admin-review-queue';
import EditCampaignPage from './pages/campaigns-edit';
import MyCampaignsPage from './pages/campaigns-mine';
import NewCampaignPage from './pages/campaigns-new';
import DashboardPlaceholder from './pages/dashboard';
import OnboardingPage from './pages/onboarding';
import PreferencesSettingsPage from './pages/settings-preferences';
import ProfileSettingsPage from './pages/settings-profile';
import VerificationSettingsPage from './pages/settings-verification';
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
              <OnboardingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/profile"
          element={
            <ProtectedRoute>
              <ProfileSettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/preferences"
          element={
            <ProtectedRoute>
              <PreferencesSettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/verification"
          element={
            <ProtectedRoute>
              <VerificationSettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/campaigns/new"
          element={
            <ProtectedRoute>
              <NewCampaignPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/campaigns/mine"
          element={
            <ProtectedRoute>
              <MyCampaignsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/campaigns/:id/edit"
          element={
            <ProtectedRoute>
              <EditCampaignPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/review-queue"
          element={
            <ProtectedRoute>
              <ReviewQueuePage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </PageShell>
  );
}
