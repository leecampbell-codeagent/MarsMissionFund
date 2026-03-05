import type { ReactElement } from 'react';
import { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { CampaignForm, dollarsToIntCents } from '../components/campaign/CampaignForm';
import type { CampaignFormData } from '../components/campaign/CampaignForm';
import { CampaignStatusBadge } from '../components/campaign/CampaignStatusBadge';
import type { MilestoneInput, UpdateCampaignInput } from '../api/campaign-api';
import { useCampaign } from '../hooks/campaign/use-campaign';
import { useUpdateCampaign } from '../hooks/campaign/use-update-campaign';
import { useSubmitCampaign } from '../hooks/campaign/use-submit-campaign';
import { ApiError } from '../lib/api-client';

export default function EditCampaignPage(): ReactElement {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: campaign, isLoading, isError } = useCampaign(id);
  const updateCampaign = useUpdateCampaign();
  const submitCampaign = useSubmitCampaign();

  const [saveError, setSaveError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccessMessage, setSubmitSuccessMessage] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="edit-campaign-page">
        <div className="edit-campaign-page__content">
          <div className="skeleton skeleton--label" />
          <div className="skeleton skeleton--heading" />
          <div className="skeleton skeleton--section" />
        </div>
        <EditCampaignStyle />
      </div>
    );
  }

  if (isError || !campaign) {
    return (
      <div className="edit-campaign-page">
        <div className="edit-campaign-page__content">
          <p className="edit-campaign-page__label">CAMPAIGN</p>
          <h1 className="edit-campaign-page__heading">CAMPAIGN NOT FOUND</h1>
          <p className="edit-campaign-page__not-found">
            This campaign does not exist or you don't have access to it.
          </p>
          <Link to="/campaigns/mine" className="edit-campaign-page__back">
            ← BACK TO MY CAMPAIGNS
          </Link>
        </div>
        <EditCampaignStyle />
      </div>
    );
  }

  const isDraft = campaign.status === 'draft';
  const isReadOnly = !isDraft;

  async function handleSaveDraft(data: CampaignFormData): Promise<void> {
    if (!id) return;
    setSaveError(null);
    try {
      const minCents = dollarsToIntCents(data.minFundingTargetDollars);
      const maxCents = dollarsToIntCents(data.maxFundingCapDollars);

      const input: UpdateCampaignInput = {
        title: data.title || null,
        category: data.category || null,
        min_funding_target_cents: String(minCents),
        max_funding_cap_cents: String(maxCents),
        summary: data.summary || null,
        description: data.description || null,
        mars_alignment_statement: data.marsAlignmentStatement || null,
        deadline: data.deadline ? new Date(data.deadline).toISOString() : null,
        budget_breakdown: data.budgetBreakdown || null,
        team_info: data.teamInfo || null,
        risk_disclosures: data.riskDisclosures || null,
        hero_image_url: data.heroImageUrl || null,
        milestones: data.milestones.map(
          (m): MilestoneInput => ({
            title: m.title || null,
            description: m.description || null,
            target_date: m.targetDate ? new Date(m.targetDate).toISOString() : null,
            funding_percentage: m.fundingPercentage
              ? Number.parseInt(m.fundingPercentage, 10)
              : null,
            verification_criteria: m.verificationCriteria || null,
          }),
        ),
      };

      await updateCampaign.mutateAsync({ id, input });
    } catch (err) {
      if (err instanceof ApiError) {
        setSaveError(err.message);
      } else {
        setSaveError('Failed to save draft. Please try again.');
      }
    }
  }

  async function handleSubmit(data: CampaignFormData): Promise<void> {
    if (!id) return;
    setSubmitError(null);
    setSubmitSuccessMessage(null);

    // Save the latest form data first, then submit
    try {
      await handleSaveDraft(data);
    } catch {
      // save error is already set; don't proceed to submit
      return;
    }

    try {
      await submitCampaign.mutateAsync(id);
      setSubmitSuccessMessage(
        'Mission submitted for review! Our team will review your campaign and notify you of the outcome.',
      );
      navigate('/campaigns/mine');
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'KYC_REQUIRED') {
          setSubmitError(
            'Identity verification required before submitting. Complete verification in Settings → Verification.',
          );
        } else {
          setSubmitError(err.message);
        }
      } else {
        setSubmitError('Failed to submit campaign. Please try again.');
      }
    }
  }

  return (
    <div className="edit-campaign-page">
      <div className="edit-campaign-page__content">
        <div className="edit-campaign-page__header">
          <div>
            <p className="edit-campaign-page__label">
              {isDraft ? 'EDIT CAMPAIGN' : 'VIEW CAMPAIGN'}
            </p>
            <h1 className="edit-campaign-page__heading">{campaign.title.toUpperCase()}</h1>
          </div>
          <div className="edit-campaign-page__status-row">
            <CampaignStatusBadge status={campaign.status} />
            <Link to="/campaigns/mine" className="edit-campaign-page__back">
              ← MY CAMPAIGNS
            </Link>
          </div>
        </div>

        {!isDraft && (
          <div className="edit-campaign-page__readonly-notice" role="note">
            This campaign has been submitted and can no longer be edited.
          </div>
        )}

        <CampaignForm
          initialData={campaign}
          onSaveDraft={(data) => handleSaveDraft(data)}
          onSubmit={isDraft ? (data) => handleSubmit(data) : undefined}
          isSaving={updateCampaign.isPending}
          isSubmitting={submitCampaign.isPending}
          saveError={saveError}
          submitError={submitError}
          submitSuccessMessage={submitSuccessMessage}
          showSubmitButton={isDraft}
          isReadOnly={isReadOnly}
        />
      </div>
      <EditCampaignStyle />
    </div>
  );
}

function EditCampaignStyle(): ReactElement {
  return (
    <style>{`
      .edit-campaign-page {
        display: flex;
        justify-content: center;
        flex: 1;
        padding: 24px 16px;
      }

      @media (min-width: 768px) {
        .edit-campaign-page { padding: 32px 24px; }
      }

      @media (min-width: 1024px) {
        .edit-campaign-page { padding: 48px 32px; }
      }

      .edit-campaign-page__content {
        max-width: 800px;
        width: 100%;
      }

      .edit-campaign-page__header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 16px;
        flex-wrap: wrap;
        margin-bottom: 32px;
      }

      .edit-campaign-page__label {
        font-family: var(--font-data);
        font-size: 11px;
        font-weight: 400;
        letter-spacing: 0.3em;
        text-transform: uppercase;
        color: var(--color-text-accent);
        margin-bottom: 12px;
      }

      .edit-campaign-page__heading {
        font-family: var(--font-display);
        font-size: 36px;
        font-weight: 400;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--color-text-primary);
        line-height: 1.1;
        margin: 0;
        max-width: 600px;
      }

      @media (min-width: 640px) {
        .edit-campaign-page__heading { font-size: 48px; }
      }

      .edit-campaign-page__status-row {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 12px;
      }

      .edit-campaign-page__back {
        font-family: var(--font-data);
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 0.1em;
        color: var(--color-text-tertiary);
        text-decoration: none;
        transition: color 0.15s ease;
      }

      .edit-campaign-page__back:hover {
        color: var(--color-text-accent);
      }

      .edit-campaign-page__readonly-notice {
        background: rgba(255, 92, 26, 0.06);
        border: 1px solid rgba(255, 92, 26, 0.2);
        border-radius: var(--radius-input);
        padding: 12px 16px;
        font-family: var(--font-body);
        font-size: 13px;
        color: var(--color-text-tertiary);
        margin-bottom: 24px;
      }

      .edit-campaign-page__not-found {
        font-family: var(--font-body);
        font-size: 15px;
        color: var(--color-text-secondary);
        margin-bottom: 24px;
      }

      .skeleton {
        background: var(--color-bg-input);
        border-radius: var(--radius-input);
        animation: skel-pulse 1.5s ease-in-out infinite alternate;
      }

      .skeleton--label { height: 14px; width: 100px; margin-bottom: 16px; }
      .skeleton--heading { height: 56px; width: 400px; margin-bottom: 32px; }
      .skeleton--section { height: 300px; width: 100%; border-radius: 8px; }

      @keyframes skel-pulse {
        from { opacity: 0.5; }
        to { opacity: 1; }
      }

      @media (prefers-reduced-motion: reduce) {
        .skeleton { animation: none; opacity: 0.7; }
      }
    `}</style>
  );
}
