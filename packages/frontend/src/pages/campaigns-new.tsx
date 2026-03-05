import type { ReactElement } from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CampaignForm, dollarsToIntCents } from '../components/campaign/CampaignForm';
import type { CampaignFormData } from '../components/campaign/CampaignForm';
import type { CreateCampaignInput, MilestoneInput } from '../api/campaign-api';
import { useCreateCampaign } from '../hooks/campaign/use-create-campaign';
import { ApiError } from '../lib/api-client';

export default function NewCampaignPage(): ReactElement {
  const navigate = useNavigate();
  const createCampaign = useCreateCampaign();
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleSaveDraft(data: CampaignFormData): Promise<void> {
    setSaveError(null);
    try {
      const minCents = dollarsToIntCents(data.minFundingTargetDollars);
      const maxCents = dollarsToIntCents(data.maxFundingCapDollars);

      const input: CreateCampaignInput = {
        title: data.title,
        category: data.category,
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

      const result = await createCampaign.mutateAsync(input);
      navigate(`/campaigns/${result.id}/edit`);
    } catch (err) {
      if (err instanceof ApiError) {
        setSaveError(err.message);
      } else {
        setSaveError('Failed to create campaign. Please try again.');
      }
    }
  }

  return (
    <div className="new-campaign-page">
      <div className="new-campaign-page__content">
        <p className="new-campaign-page__label">NEW CAMPAIGN</p>
        <h1 className="new-campaign-page__heading">LAUNCH YOUR MISSION</h1>

        <CampaignForm
          onSaveDraft={(data) => handleSaveDraft(data)}
          isSaving={createCampaign.isPending}
          saveError={saveError}
          showSubmitButton={false}
        />
      </div>

      <style>{`
        .new-campaign-page {
          display: flex;
          justify-content: center;
          flex: 1;
          padding: 24px 16px;
        }

        @media (min-width: 768px) {
          .new-campaign-page { padding: 32px 24px; }
        }

        @media (min-width: 1024px) {
          .new-campaign-page { padding: 48px 32px; }
        }

        .new-campaign-page__content {
          max-width: 800px;
          width: 100%;
        }

        .new-campaign-page__label {
          font-family: var(--font-data);
          font-size: 11px;
          font-weight: 400;
          letter-spacing: 0.3em;
          text-transform: uppercase;
          color: var(--color-text-accent);
          margin-bottom: 16px;
        }

        .new-campaign-page__heading {
          font-family: var(--font-display);
          font-size: 48px;
          font-weight: 400;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--color-text-primary);
          line-height: 1;
          margin-bottom: 40px;
        }

        @media (min-width: 640px) {
          .new-campaign-page__heading { font-size: 64px; }
        }
      `}</style>
    </div>
  );
}
