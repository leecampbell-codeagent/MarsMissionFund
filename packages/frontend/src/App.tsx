import { Navigate, Route, Routes } from 'react-router-dom';
import { Header } from './components/layout/header.js';
import { OnboardingGuard } from './components/layout/onboarding-guard.js';
import { ProtectedRoute } from './components/layout/protected-route.js';
import DashboardPage from './pages/dashboard.js';
import KycStubPage from './pages/kyc-stub.js';
import OnboardingPage from './pages/onboarding.js';
import ProfilePage from './pages/profile.js';
import SignInPage from './pages/sign-in.js';
import SignUpPage from './pages/sign-up.js';

export function App() {
  return (
    <>
      <Header />
      <main style={{ paddingTop: '64px' }}>
        <Routes>
          <Route path="/sign-in/*" element={<SignInPage />} />
          <Route path="/sign-up/*" element={<SignUpPage />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
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
            path="/profile"
            element={
              <ProtectedRoute>
                <OnboardingGuard>
                  <ProfilePage />
                </OnboardingGuard>
              </ProtectedRoute>
            }
          />
          <Route
            path="/kyc"
            element={
              <ProtectedRoute>
                <OnboardingGuard>
                  <KycStubPage />
                </OnboardingGuard>
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  );
}
