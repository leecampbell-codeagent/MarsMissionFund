import { type ReactElement, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  type AccountRole,
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferences,
  type OnboardingStep,
} from '../api/account-api';
import { AuthLoadingScreen } from '../components/auth/auth-loading-screen';
import {
  CompletionStep,
  PreferencesStep,
  ProfileStep,
  RoleSelectionStep,
  StepProgressIndicator,
  WelcomeStep,
} from '../components/onboarding';
import { useAccount } from '../hooks/account/use-account';
import { useAdvanceOnboarding } from '../hooks/account/use-advance-onboarding';
import { useUpdatePreferences } from '../hooks/account/use-update-preferences';
import { useUpdateProfile } from '../hooks/account/use-update-profile';

type WizardRole = 'backer' | 'creator' | 'both';

const STEPS = [
  { label: 'Welcome' },
  { label: 'Role' },
  { label: 'Profile' },
  { label: 'Preferences' },
  { label: 'Complete' },
];

function stepToIndex(step: OnboardingStep): number {
  switch (step) {
    case 'welcome':
      return 0;
    case 'role_selection':
      return 1;
    case 'profile':
      return 2;
    case 'preferences':
      return 3;
    case 'completed':
      return 4;
  }
}

function rolesToWizardRole(roles: readonly AccountRole[]): WizardRole {
  if (roles.includes('creator')) {
    return roles.length >= 2 ? 'both' : 'creator';
  }
  return 'backer';
}

function wizardRoleToAccountRoles(role: WizardRole): readonly AccountRole[] {
  if (role === 'creator') return ['backer', 'creator'];
  if (role === 'both') return ['backer', 'creator'];
  return ['backer'];
}

export default function OnboardingPage(): ReactElement {
  const navigate = useNavigate();
  const { data: account, isLoading, error } = useAccount();
  const advanceOnboarding = useAdvanceOnboarding();
  const updateProfile = useUpdateProfile();
  const updatePreferences = useUpdatePreferences();

  // Local wizard state (client-side navigation is allowed to go back)
  const [localStep, setLocalStep] = useState<OnboardingStep | null>(null);
  const [selectedRole, setSelectedRole] = useState<WizardRole>('backer');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [profileErrors, setProfileErrors] = useState<{
    displayName?: string;
    avatarUrl?: string;
  }>({});
  const [preferences, setPreferences] = useState<NotificationPreferences>(
    DEFAULT_NOTIFICATION_PREFERENCES,
  );
  const [mutationError, setMutationError] = useState<string | null>(null);

  const headingRef = useRef<HTMLHeadingElement>(null);

  // When account loads, initialize local state from server state
  useEffect(() => {
    if (account) {
      if (account.onboarding_completed) {
        void navigate('/dashboard', { replace: true });
        return;
      }
      if (localStep === null) {
        setLocalStep(account.onboarding_step);
      }
      // Pre-fill profile fields from existing data
      if (account.display_name) setDisplayName(account.display_name);
      if (account.bio) setBio(account.bio);
      if (account.avatar_url) setAvatarUrl(account.avatar_url);
      // Pre-fill role
      setSelectedRole(rolesToWizardRole(account.roles));
      // Pre-fill preferences
      setPreferences(account.notification_preferences);
    }
  }, [account, navigate, localStep]);

  // Focus heading when step changes
  useEffect(() => {
    if (localStep !== null) {
      headingRef.current?.focus();
    }
  }, [localStep]);

  function validateProfile(): boolean {
    const errors: { displayName?: string; avatarUrl?: string } = {};
    if (displayName && displayName.trim().length === 0) {
      errors.displayName = 'Display name cannot be blank.';
    }
    if (displayName && displayName.trim().length > 100) {
      errors.displayName = 'Display name must be 100 characters or fewer.';
    }
    if (avatarUrl && !avatarUrl.startsWith('https://')) {
      errors.avatarUrl = 'Avatar URL must start with https://';
    }
    setProfileErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleWelcomeContinue(): Promise<void> {
    setMutationError(null);
    try {
      await advanceOnboarding.mutateAsync({ step: 'role_selection' });
      setLocalStep('role_selection');
    } catch {
      setMutationError("Something went wrong. Let's try that again.");
    }
  }

  async function handleRoleContinue(): Promise<void> {
    setMutationError(null);
    const roles = wizardRoleToAccountRoles(selectedRole);
    try {
      await advanceOnboarding.mutateAsync({ step: 'profile', roles });
      setLocalStep('profile');
    } catch {
      setMutationError("Something went wrong. Let's try that again.");
    }
  }

  async function handleProfileContinue(): Promise<void> {
    if (!validateProfile()) return;
    setMutationError(null);
    try {
      // Only save profile if any field is filled
      if (displayName.trim() || bio.trim() || avatarUrl.trim()) {
        await updateProfile.mutateAsync({
          display_name: displayName.trim() || null,
          bio: bio.trim() || null,
          avatar_url: avatarUrl.trim() || null,
        });
      }
      await advanceOnboarding.mutateAsync({ step: 'preferences' });
      setLocalStep('preferences');
    } catch {
      setMutationError('Something went wrong. Try again.');
    }
  }

  async function handleProfileSkip(): Promise<void> {
    setMutationError(null);
    try {
      await advanceOnboarding.mutateAsync({ step: 'preferences' });
      setLocalStep('preferences');
    } catch {
      setMutationError('Something went wrong. Try again.');
    }
  }

  async function handlePreferencesComplete(): Promise<void> {
    setMutationError(null);
    try {
      await updatePreferences.mutateAsync(preferences);
      await advanceOnboarding.mutateAsync({ step: 'completed' });
      setLocalStep('completed');
    } catch {
      setMutationError('Something went wrong. Try again.');
    }
  }

  async function handlePreferencesSkip(): Promise<void> {
    setMutationError(null);
    try {
      await advanceOnboarding.mutateAsync({ step: 'completed' });
      setLocalStep('completed');
    } catch {
      setMutationError('Something went wrong. Try again.');
    }
  }

  function handleGoToDashboard(): void {
    void navigate('/dashboard');
  }

  function handlePreferenceChange(key: keyof NotificationPreferences, value: boolean): void {
    setPreferences((prev) => ({ ...prev, [key]: value }));
  }

  if (error) {
    return (
      <div className="onboarding-error">
        <p className="onboarding-error__text">
          We couldn&apos;t load your account. Try refreshing.
        </p>
        <button
          type="button"
          className="onboarding-error__btn"
          onClick={() => window.location.reload()}
        >
          Try Again
        </button>
        <style>{`

          .onboarding-error {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            flex: 1;
            gap: 16px;
            text-align: center;
          }
          .onboarding-error__text {
            font-family: var(--font-body);
            font-size: 16px;
            color: var(--color-text-error);
          }
          .onboarding-error__btn {
            background: var(--color-action-secondary-bg);
            color: var(--color-action-secondary-text);
            border: 1px solid var(--color-action-secondary-border);
            border-radius: var(--radius-button);
            font-family: var(--font-body);
            font-size: 14px;
            font-weight: 600;
            padding: 12px 24px;
            cursor: pointer;
          }
        `}</style>
      </div>
    );
  }

  if (isLoading || localStep === null) {
    return <AuthLoadingScreen />;
  }

  const currentStepIndex = stepToIndex(localStep);
  const isWelcome = localStep === 'welcome';
  const isCompleted = localStep === 'completed';
  const isMutating =
    advanceOnboarding.isPending || updateProfile.isPending || updatePreferences.isPending;

  return (
    <>
      <div className="onboarding-wizard">
        <div className="onboarding-wizard__content">
          {!isWelcome && !isCompleted && (
            <StepProgressIndicator currentStep={currentStepIndex - 1} steps={STEPS.slice(1, -1)} />
          )}

          <section
            className="onboarding-wizard__step"
            aria-live="polite"
            aria-label="Onboarding step content"
          >
            {localStep === 'welcome' && (
              <WelcomeStep
                onContinue={() => void handleWelcomeContinue()}
                isLoading={advanceOnboarding.isPending}
                error={mutationError}
              />
            )}
            {localStep === 'role_selection' && (
              <RoleSelectionStep
                selectedRole={selectedRole}
                onRoleChange={setSelectedRole}
                onContinue={() => void handleRoleContinue()}
                onBack={() => setLocalStep('welcome')}
                isLoading={isMutating}
                error={mutationError}
              />
            )}
            {localStep === 'profile' && (
              <ProfileStep
                displayName={displayName}
                bio={bio}
                avatarUrl={avatarUrl}
                onDisplayNameChange={setDisplayName}
                onBioChange={setBio}
                onAvatarUrlChange={setAvatarUrl}
                errors={profileErrors}
                onContinue={() => void handleProfileContinue()}
                onSkip={() => void handleProfileSkip()}
                onBack={() => setLocalStep('role_selection')}
                isLoading={isMutating}
              />
            )}
            {localStep === 'preferences' && (
              <PreferencesStep
                preferences={preferences}
                onPreferenceChange={handlePreferenceChange}
                onComplete={() => void handlePreferencesComplete()}
                onSkip={() => void handlePreferencesSkip()}
                onBack={() => setLocalStep('profile')}
                isLoading={isMutating}
                error={mutationError}
              />
            )}
            {localStep === 'completed' && (
              <CompletionStep
                displayName={(account?.display_name ?? displayName) || null}
                onGoToDashboard={handleGoToDashboard}
              />
            )}
          </section>
        </div>
      </div>
      <style>{`
        .onboarding-wizard {
          display: flex;
          flex-direction: column;
          align-items: center;
          flex: 1;
          padding: 24px 0;
        }

        @media (min-width: 768px) {
          .onboarding-wizard {
            padding: 32px 0;
          }
        }

        @media (min-width: 1024px) {
          .onboarding-wizard {
            padding: 48px 0;
          }
        }

        .onboarding-wizard__content {
          max-width: 600px;
          width: 100%;
        }

        .onboarding-wizard__step {
          width: 100%;
        }
      `}</style>
    </>
  );
}
