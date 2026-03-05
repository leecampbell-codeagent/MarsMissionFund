import { type ReactElement, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateProfile, updateNotificationPrefs, type NotificationPrefs } from '../../api/account-api';
import { useCurrentUser, CURRENT_USER_QUERY_KEY } from '../../hooks/account/use-current-user';
import { OnboardingStepIndicator } from '../../components/account/onboarding-step-indicator';
import { OnboardingWelcomeStep } from '../../components/account/onboarding-welcome-step';
import { OnboardingRoleStep } from '../../components/account/onboarding-role-step';
import { OnboardingProfileStep } from '../../components/account/onboarding-profile-step';
import { OnboardingNotificationsStep } from '../../components/account/onboarding-notifications-step';
import { OnboardingCompleteStep } from '../../components/account/onboarding-complete-step';

const TOTAL_STEPS = 5;

/**
 * OnboardingPage — /onboarding
 * 5-step post-registration wizard.
 * Redirects to / if onboardingCompleted is already true.
 */
export default function OnboardingPage(): ReactElement {
  const [currentStep, setCurrentStep] = useState(1);
  const [profileError, setProfileError] = useState<string | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();

  // Redirect if onboarding already completed
  useEffect(() => {
    if (user?.onboardingCompleted) {
      void navigate('/', { replace: true });
    }
  }, [user?.onboardingCompleted, navigate]);

  const profileMutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CURRENT_USER_QUERY_KEY });
      setProfileError(null);
      setCurrentStep((s) => s + 1);
    },
    onError: () => {
      setProfileError("We couldn't save your profile. Try again.");
    },
  });

  const notifMutation = useMutation({
    mutationFn: updateNotificationPrefs,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CURRENT_USER_QUERY_KEY });
      setCurrentStep((s) => s + 1);
    },
    onError: () => {
      // Error handled inline in component
    },
  });

  const completeMutation = useMutation({
    mutationFn: () =>
      updateProfile({
        onboardingCompleted: true,
        onboardingStep: 'complete',
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CURRENT_USER_QUERY_KEY });
    },
  });

  // Trigger complete mutation when reaching step 5
  useEffect(() => {
    if (currentStep === TOTAL_STEPS) {
      completeMutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep]);

  // Auto-redirect after step 5 settles
  useEffect(() => {
    if (currentStep === TOTAL_STEPS) {
      const timer = setTimeout(() => {
        void navigate('/', { replace: true });
      }, 2000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [currentStep, navigate]);

  const handleProfileNext = (data: { displayName: string; bio: string }) => {
    profileMutation.mutate({
      displayName: data.displayName || null,
      bio: data.bio || null,
      onboardingStep: 'profiling',
    });
  };

  const handleProfileSkip = () => {
    void profileMutation.mutateAsync({ onboardingStep: 'profiling' }).catch(() => {
      // Skip anyway
    });
    setCurrentStep((s) => s + 1);
  };

  const handleNotifNext = (prefs: Partial<NotificationPrefs>) => {
    notifMutation.mutate(prefs);
  };

  const pageStyle: React.CSSProperties = {
    minHeight: '100vh',
    background: 'var(--color-bg-page)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '48px 24px',
  };

  const contentStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: '640px',
  };

  return (
    <div style={pageStyle}>
      <div style={contentStyle}>
        {currentStep < TOTAL_STEPS && (
          <div style={{ marginBottom: '32px' }}>
            <OnboardingStepIndicator currentStep={currentStep} totalSteps={TOTAL_STEPS} />
          </div>
        )}

        {currentStep === 1 && (
          <OnboardingWelcomeStep onNext={() => setCurrentStep(2)} />
        )}

        {currentStep === 2 && (
          <OnboardingRoleStep
            onNext={() => setCurrentStep(3)}
            onBack={() => setCurrentStep(1)}
          />
        )}

        {currentStep === 3 && (
          <OnboardingProfileStep
            onNext={handleProfileNext}
            onBack={() => setCurrentStep(2)}
            onSkip={handleProfileSkip}
            isSaving={profileMutation.isPending}
            initialValues={{
              displayName: user?.displayName ?? null,
              bio: user?.bio ?? null,
            }}
            error={profileError}
          />
        )}

        {currentStep === 4 && (
          <OnboardingNotificationsStep
            onNext={handleNotifNext}
            onBack={() => setCurrentStep(3)}
            isSaving={notifMutation.isPending}
            initialPrefs={user?.notificationPrefs}
          />
        )}

        {currentStep === TOTAL_STEPS && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
            <OnboardingCompleteStep displayName={user?.displayName ?? null} />
          </div>
        )}
      </div>
    </div>
  );
}









