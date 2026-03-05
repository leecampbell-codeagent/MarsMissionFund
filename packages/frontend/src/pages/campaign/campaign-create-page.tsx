import { type ReactElement, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ApiError } from '../../api/client';
import { CampaignForm } from '../../components/campaign/campaign-form/CampaignForm';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { useAssignCreatorRole } from '../../hooks/account/use-assign-creator-role';
import { useCurrentUser } from '../../hooks/account/use-current-user';
import { useCreateCampaign } from '../../hooks/campaign/use-create-campaign';
import { useSubmitCampaign } from '../../hooks/campaign/use-submit-campaign';
import { useUpdateCampaign } from '../../hooks/campaign/use-update-campaign';
import type { Campaign } from '../../types/campaign';

/**
 * CampaignCreatePage — /campaigns/new
 * Auth: Required. Creator + KYC verified.
 * Creates a draft campaign on mount, then allows the creator to fill all sections.
 */
export default function CampaignCreatePage(): ReactElement {
  const navigate = useNavigate();
  const { user, isLoading: userLoading } = useCurrentUser();
  const { createCampaign, isLoading: isCreating, error: createError } = useCreateCampaign();
  const { updateCampaign } = useUpdateCampaign();
  const { submitCampaign, isLoading: isSubmitting, error: submitError } = useSubmitCampaign();
  const {
    assignCreatorRole,
    isLoading: isAssigningRole,
    error: roleError,
  } = useAssignCreatorRole();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [initError, setInitError] = useState<ApiError | null>(null);

  const isKycVerified = user?.kycStatus === 'verified';
  const isCreator = user?.roles.includes('creator') ?? false;

  // Create draft on mount once user loads and has required permissions
  useEffect(() => {
    if (!user || !isKycVerified || !isCreator || campaign) return;

    createCampaign('Untitled Campaign')
      .then((created) => {
        setCampaign(created);
      })
      .catch((err: ApiError) => {
        setInitError(err);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isKycVerified, isCreator, campaign, createCampaign]);

  const handleUpdate = async (id: string, input: Parameters<typeof updateCampaign>[1]) => {
    const updated = await updateCampaign(id, input);
    setCampaign(updated);
    return updated;
  };

  const handleSubmit = async (id: string) => {
    const submitted = await submitCampaign(id);
    navigate(`/campaigns/${submitted.id}`);
    return submitted;
  };

  const handleAssignRole = async () => {
    await assignCreatorRole();
  };

  // Loading auth state
  if (userLoading) {
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
        <LoadingSpinner size="lg" label="Loading" />
      </div>
    );
  }

  // KYC gate
  if (!isKycVerified) {
    return (
      <div
        style={{
          background: 'var(--color-bg-page)',
          minHeight: '100vh',
          padding: '48px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            maxWidth: '480px',
            background: 'var(--color-bg-surface)',
            border: '1px solid color-mix(in srgb, var(--color-status-warning) 25%, transparent)',
            borderTop: '2px solid var(--color-status-warning)',
            borderRadius: 'var(--radius-card)',
            padding: '32px',
          }}
        >
          <p
            style={{ fontSize: '24px', margin: '0 0 12px', color: 'var(--color-status-warning)' }}
            aria-hidden="true"
          >
            ⚠
          </p>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '24px',
              textTransform: 'uppercase',
              color: 'var(--color-text-primary)',
              margin: '0 0 12px',
            }}
          >
            Identity Verification Required
          </h1>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '14px',
              color: 'var(--color-text-secondary)',
              margin: '0 0 24px',
              lineHeight: 1.6,
            }}
          >
            You must complete identity verification before creating a campaign. This keeps the
            platform safe for all backers.
          </p>
          <Button variant="secondary" size="md" onClick={() => navigate('/settings/profile')}>
            Verify Your Identity →
          </Button>
        </div>
      </div>
    );
  }

  // Creator role gate
  if (!isCreator) {
    return (
      <div
        style={{
          background: 'var(--color-bg-page)',
          minHeight: '100vh',
          padding: '48px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            maxWidth: '480px',
            background: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 'var(--radius-card)',
            padding: '32px',
          }}
        >
          <p
            style={{ fontSize: '24px', margin: '0 0 12px', color: 'var(--color-action-primary)' }}
            aria-hidden="true"
          >
            🚀
          </p>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '24px',
              textTransform: 'uppercase',
              color: 'var(--color-text-primary)',
              margin: '0 0 12px',
            }}
          >
            Creator Role Required
          </h1>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '14px',
              color: 'var(--color-text-secondary)',
              margin: '0 0 24px',
              lineHeight: 1.6,
            }}
          >
            Designate yourself as a project creator to start building campaigns.
          </p>
          {roleError && (
            <p
              role="alert"
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '13px',
                color: 'var(--color-status-error)',
                margin: '0 0 16px',
              }}
            >
              {roleError.message}
            </p>
          )}
          <Button
            variant="primary"
            size="md"
            onClick={() => {
              void handleAssignRole();
            }}
            isLoading={isAssigningRole}
            disabled={isAssigningRole}
          >
            Become a Creator
          </Button>
        </div>
      </div>
    );
  }

  // Creating initial draft
  if (isCreating || !campaign) {
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
        <LoadingSpinner size="lg" label="Creating your campaign draft..." />
      </div>
    );
  }

  // Init error
  if (initError) {
    return (
      <div
        style={{
          background: 'var(--color-bg-page)',
          minHeight: '100vh',
          padding: '48px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: '400px' }}>
          <p
            role="alert"
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '14px',
              color: 'var(--color-status-error)',
            }}
          >
            Failed to create campaign: {initError.message}
          </p>
          <Button variant="secondary" onClick={() => window.location.reload()}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        background: 'var(--color-bg-page)',
        minHeight: '100vh',
        padding: '48px 24px',
      }}
    >
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        {/* Page header */}
        <header style={{ marginBottom: '40px' }}>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '12px',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: 'var(--color-text-accent)',
              margin: '0 0 8px',
            }}
          >
            01 — NEW MISSION PROPOSAL
          </p>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '48px',
              textTransform: 'uppercase',
              color: 'var(--color-text-primary)',
              margin: '0 0 8px',
              lineHeight: 1,
            }}
          >
            Build Your Campaign
          </h1>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '14px',
              color: 'var(--color-text-secondary)',
              margin: 0,
            }}
          >
            Draft auto-saves as you go.
          </p>
        </header>

        {/* Create error */}
        {createError && (
          <div
            role="alert"
            style={{
              background: 'color-mix(in srgb, var(--color-status-error) 10%, transparent)',
              border: '1px solid color-mix(in srgb, var(--color-status-error) 30%, transparent)',
              borderRadius: 'var(--radius-card)',
              padding: '12px 16px',
              marginBottom: '24px',
            }}
          >
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '13px',
                color: 'var(--color-status-error)',
                margin: 0,
              }}
            >
              {createError.message}
            </p>
          </div>
        )}

        <CampaignForm
          campaign={campaign}
          onUpdate={handleUpdate}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          submitError={submitError}
        />
      </div>
    </div>
  );
}
