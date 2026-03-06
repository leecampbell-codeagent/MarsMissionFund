import { useUser } from '@clerk/react';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { KycPromptModal } from '../components/onboarding/kyc-prompt-modal.js';
import { LoadingSpinner } from '../components/ui/loading-spinner.js';
import { useCompleteOnboarding } from '../hooks/use-complete-onboarding.js';
import { useCurrentUser } from '../hooks/use-current-user.js';
import { useSaveOnboardingStep } from '../hooks/use-save-onboarding-step.js';

type Step = 1 | 2 | 3;

export default function OnboardingPage() {
  const { data: meData, isLoading: meLoading } = useCurrentUser();
  const { user } = useUser();
  const navigate = useNavigate();
  const completeOnboarding = useCompleteOnboarding();
  const saveOnboardingStep = useSaveOnboardingStep();

  const resolvedInitialStep: Step = (() => {
    const s = meData?.data.onboardingStep;
    if (s === 1 || s === 2 || s === 3) return s;
    return 1;
  })();

  const [step, setStep] = useState<Step>(resolvedInitialStep);
  const [selectedRoles, setSelectedRoles] = useState<('backer' | 'creator')[]>([]);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [showKycModal, setShowKycModal] = useState(false);

  if (meLoading) {
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

  if (meData?.data.onboardingCompleted === true) {
    return <Navigate to="/dashboard" replace />;
  }

  const goToStep = (nextStep: Step) => {
    setStep(nextStep);
    saveOnboardingStep.mutate({ step: nextStep });
  };

  const toggleRole = (role: 'backer' | 'creator') => {
    setSelectedRoles((prev) => {
      if (prev.includes(role)) {
        return prev.filter((r) => r !== role);
      }
      const next = [...prev, role];
      if (role === 'creator' && !prev.includes('creator')) {
        setShowKycModal(true);
      }
      return next;
    });
  };

  const handleCompleteSetup = () => {
    const input: {
      step: number;
      roles: ('backer' | 'creator')[];
      displayName?: string;
      bio?: string;
    } = {
      step: 3,
      roles: selectedRoles,
    };

    const trimmedName = displayName.trim();
    if (trimmedName.length > 0) {
      input.displayName = trimmedName;
    }

    if (bio.trim().length > 0) {
      input.bio = bio.trim();
    }

    completeOnboarding.mutate(input, {
      onSuccess: () => {
        void navigate('/dashboard', { replace: true });
      },
    });
  };

  return (
    <>
      <title>Onboarding — Mars Mission Fund</title>
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: 'var(--color-bg-page)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 24px',
        }}
      >
        <div
          style={{
            maxWidth: '560px',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: '32px',
          }}
        >
          {/* Step 1: Welcome */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <p
                style={{
                  fontFamily: 'var(--font-data)',
                  fontSize: '11px',
                  fontWeight: 400,
                  letterSpacing: '0.3em',
                  textTransform: 'uppercase',
                  color: 'var(--color-text-accent)',
                  margin: 0,
                }}
              >
                01 — WELCOME
              </p>

              <h1
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '56px',
                  fontWeight: 400,
                  letterSpacing: '0.04em',
                  color: 'var(--color-text-primary)',
                  lineHeight: 1,
                  margin: 0,
                  textTransform: 'uppercase',
                }}
              >
                READY FOR LAUNCH
              </h1>

              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '16px',
                  fontWeight: 400,
                  lineHeight: 1.7,
                  color: 'var(--color-text-secondary)',
                  margin: 0,
                }}
              >
                Join the mission. Back the projects taking humanity to Mars. Let&apos;s get you set
                up — it takes less than two minutes.
              </p>

              <button
                type="button"
                onClick={() => goToStep(2)}
                style={{
                  alignSelf: 'flex-start',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: '44px',
                  padding: '12px 32px',
                  fontFamily: 'var(--font-body)',
                  fontSize: '14px',
                  fontWeight: 600,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  color: 'var(--color-text-on-action)',
                  background: 'var(--gradient-action-primary)',
                  border: 'none',
                  borderRadius: 'var(--radius-button)',
                  cursor: 'pointer',
                }}
              >
                BEGIN MISSION SETUP
              </button>
            </div>
          )}

          {/* Step 2: Role Selection */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <p
                style={{
                  fontFamily: 'var(--font-data)',
                  fontSize: '11px',
                  fontWeight: 400,
                  letterSpacing: '0.3em',
                  textTransform: 'uppercase',
                  color: 'var(--color-text-accent)',
                  margin: 0,
                }}
              >
                02 — YOUR ROLE
              </p>

              <h1
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '48px',
                  fontWeight: 400,
                  letterSpacing: '0.04em',
                  color: 'var(--color-text-primary)',
                  lineHeight: 1,
                  margin: 0,
                  textTransform: 'uppercase',
                }}
              >
                HOW WILL YOU CONTRIBUTE?
              </h1>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                {/* Backer card */}
                <button
                  type="button"
                  onClick={() => toggleRole('backer')}
                  aria-pressed={selectedRoles.includes('backer')}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    padding: '20px',
                    backgroundColor: selectedRoles.includes('backer')
                      ? 'var(--color-bg-surface-raised)'
                      : 'var(--color-bg-surface)',
                    border: selectedRoles.includes('backer')
                      ? '2px solid var(--color-action-primary)'
                      : '1px solid var(--color-border-subtle)',
                    borderRadius: 'var(--radius-card)',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '20px',
                      color: 'var(--color-text-primary)',
                      textTransform: 'uppercase',
                    }}
                  >
                    Backer
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: '14px',
                      color: 'var(--color-text-secondary)',
                    }}
                  >
                    Fund breakthrough Mars missions
                  </span>
                </button>

                {/* Creator card */}
                <button
                  type="button"
                  onClick={() => toggleRole('creator')}
                  aria-pressed={selectedRoles.includes('creator')}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    padding: '20px',
                    backgroundColor: selectedRoles.includes('creator')
                      ? 'var(--color-bg-surface-raised)'
                      : 'var(--color-bg-surface)',
                    border: selectedRoles.includes('creator')
                      ? '2px solid var(--color-action-primary)'
                      : '1px solid var(--color-border-subtle)',
                    borderRadius: 'var(--radius-card)',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '20px',
                      color: 'var(--color-text-primary)',
                      textTransform: 'uppercase',
                    }}
                  >
                    Creator
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: '14px',
                      color: 'var(--color-text-secondary)',
                    }}
                  >
                    Launch your own mission campaign
                  </span>
                </button>
              </div>

              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => goToStep(1)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '44px',
                    padding: '12px 24px',
                    fontFamily: 'var(--font-body)',
                    fontSize: '14px',
                    fontWeight: 600,
                    letterSpacing: '0.01em',
                    color: 'var(--color-action-ghost-text)',
                    backgroundColor: 'transparent',
                    border: '1px solid var(--color-action-ghost-border)',
                    borderRadius: 'var(--radius-button)',
                    cursor: 'pointer',
                  }}
                >
                  Back
                </button>

                <button
                  type="button"
                  onClick={() => goToStep(3)}
                  disabled={selectedRoles.length === 0}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '44px',
                    padding: '12px 32px',
                    fontFamily: 'var(--font-body)',
                    fontSize: '14px',
                    fontWeight: 600,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    color: 'var(--color-text-on-action)',
                    background: 'var(--gradient-action-primary)',
                    border: 'none',
                    borderRadius: 'var(--radius-button)',
                    cursor: selectedRoles.length === 0 ? 'not-allowed' : 'pointer',
                    opacity: selectedRoles.length === 0 ? 0.5 : 1,
                  }}
                >
                  CONTINUE
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Profile */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <p
                style={{
                  fontFamily: 'var(--font-data)',
                  fontSize: '11px',
                  fontWeight: 400,
                  letterSpacing: '0.3em',
                  textTransform: 'uppercase',
                  color: 'var(--color-text-accent)',
                  margin: 0,
                }}
              >
                03 — YOUR PROFILE
              </p>

              <h1
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '48px',
                  fontWeight: 400,
                  letterSpacing: '0.04em',
                  color: 'var(--color-text-primary)',
                  lineHeight: 1,
                  margin: 0,
                  textTransform: 'uppercase',
                }}
              >
                TELL US ABOUT YOURSELF
              </h1>

              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '16px',
                  fontWeight: 400,
                  lineHeight: 1.7,
                  color: 'var(--color-text-secondary)',
                  margin: 0,
                }}
              >
                Optional — you can always update this later from your profile.
              </p>

              {/* Avatar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                {user?.imageUrl ? (
                  <img
                    src={user.imageUrl}
                    alt="Your avatar"
                    style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                    }}
                  />
                ) : (
                  <div
                    role="img"
                    aria-label="Avatar placeholder"
                    style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--color-bg-surface)',
                      border: '1px solid var(--color-border-subtle)',
                    }}
                  />
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label
                    htmlFor="displayName"
                    style={{
                      fontFamily: 'var(--font-data)',
                      fontSize: '11px',
                      letterSpacing: '0.2em',
                      textTransform: 'uppercase',
                      color: 'var(--color-text-tertiary)',
                    }}
                  >
                    Display Name
                  </label>
                  <input
                    id="displayName"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    maxLength={100}
                    placeholder="Your name"
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: '16px',
                      color: 'var(--color-text-primary)',
                      backgroundColor: 'var(--color-bg-surface)',
                      border: '1px solid var(--color-border-subtle)',
                      borderRadius: 'var(--radius-input)',
                      padding: '12px 16px',
                      outline: 'none',
                      width: '100%',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label
                    htmlFor="bio"
                    style={{
                      fontFamily: 'var(--font-data)',
                      fontSize: '11px',
                      letterSpacing: '0.2em',
                      textTransform: 'uppercase',
                      color: 'var(--color-text-tertiary)',
                    }}
                  >
                    Bio
                  </label>
                  <textarea
                    id="bio"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    maxLength={500}
                    rows={4}
                    placeholder="Tell us about yourself"
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: '16px',
                      color: 'var(--color-text-primary)',
                      backgroundColor: 'var(--color-bg-surface)',
                      border: '1px solid var(--color-border-subtle)',
                      borderRadius: 'var(--radius-input)',
                      padding: '12px 16px',
                      outline: 'none',
                      width: '100%',
                      boxSizing: 'border-box',
                      resize: 'vertical',
                    }}
                  />
                  <p
                    style={{
                      fontFamily: 'var(--font-data)',
                      fontSize: '11px',
                      color: 'var(--color-text-tertiary)',
                      margin: 0,
                      textAlign: 'right',
                    }}
                  >
                    {bio.length}/500
                  </p>
                </div>
              </div>

              {completeOnboarding.isError && (
                <p
                  role="alert"
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '14px',
                    color: 'var(--color-status-error)',
                    margin: 0,
                  }}
                >
                  {completeOnboarding.error instanceof Error
                    ? completeOnboarding.error.message
                    : 'Something went wrong. Please try again.'}
                </p>
              )}

              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => goToStep(2)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '44px',
                    padding: '12px 24px',
                    fontFamily: 'var(--font-body)',
                    fontSize: '14px',
                    fontWeight: 600,
                    letterSpacing: '0.01em',
                    color: 'var(--color-action-ghost-text)',
                    backgroundColor: 'transparent',
                    border: '1px solid var(--color-action-ghost-border)',
                    borderRadius: 'var(--radius-button)',
                    cursor: 'pointer',
                  }}
                >
                  Back
                </button>

                <button
                  type="button"
                  onClick={handleCompleteSetup}
                  disabled={completeOnboarding.isPending}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    minHeight: '44px',
                    padding: '12px 32px',
                    fontFamily: 'var(--font-body)',
                    fontSize: '14px',
                    fontWeight: 600,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    color: 'var(--color-text-on-action)',
                    background: 'var(--gradient-action-primary)',
                    border: 'none',
                    borderRadius: 'var(--radius-button)',
                    cursor: completeOnboarding.isPending ? 'not-allowed' : 'pointer',
                    opacity: completeOnboarding.isPending ? 0.7 : 1,
                  }}
                >
                  {completeOnboarding.isPending ? (
                    <LoadingSpinner size="sm" label="Completing setup" />
                  ) : (
                    'COMPLETE SETUP'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showKycModal && <KycPromptModal onClose={() => setShowKycModal(false)} />}

      <style>{`
        @media (prefers-reduced-motion: reduce) {
          * {
            transition: none !important;
            animation: none !important;
          }
        }
        button:focus-visible {
          outline: 2px solid var(--color-action-primary-hover);
          outline-offset: 2px;
        }
        input:focus, textarea:focus {
          border-color: var(--color-action-primary);
        }
      `}</style>
    </>
  );
}
