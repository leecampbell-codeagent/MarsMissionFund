import { type ReactElement, useState } from 'react';
import type { CampaignCategory, CampaignResponse } from '../../api/campaign-api';
import { MilestoneEditor, type MilestoneFormItem } from './MilestoneEditor';

const CAMPAIGN_CATEGORIES: ReadonlyArray<{ value: CampaignCategory; label: string }> = [
  { value: 'propulsion', label: 'Propulsion' },
  { value: 'entry_descent_landing', label: 'Entry, Descent & Landing' },
  { value: 'power_energy', label: 'Power & Energy' },
  { value: 'habitats_construction', label: 'Habitats & Construction' },
  { value: 'life_support_crew_health', label: 'Life Support & Crew Health' },
  { value: 'food_water_production', label: 'Food & Water Production' },
  { value: 'isru', label: 'In-Situ Resource Utilisation (ISRU)' },
  { value: 'radiation_protection', label: 'Radiation Protection' },
  { value: 'robotics_automation', label: 'Robotics & Automation' },
  { value: 'communications_navigation', label: 'Communications & Navigation' },
];

export interface CampaignFormData {
  title: string;
  category: CampaignCategory;
  summary: string;
  description: string;
  marsAlignmentStatement: string;
  minFundingTargetDollars: string;
  maxFundingCapDollars: string;
  deadline: string;
  budgetBreakdown: string;
  teamInfo: string;
  riskDisclosures: string;
  heroImageUrl: string;
  milestones: MilestoneFormItem[];
}

interface CampaignFormProps {
  readonly initialData?: Partial<CampaignResponse>;
  readonly onSaveDraft: (data: CampaignFormData) => Promise<void>;
  readonly onSubmit?: (data: CampaignFormData) => Promise<void>;
  readonly isSaving?: boolean;
  readonly isSubmitting?: boolean;
  readonly saveError?: string | null;
  readonly submitError?: string | null;
  readonly submitSuccessMessage?: string | null;
  readonly showSubmitButton?: boolean;
  readonly isReadOnly?: boolean;
}

function centsToDisplayDollars(cents: string | undefined): string {
  if (!cents) return '';
  const num = Number(cents);
  if (Number.isNaN(num)) return '';
  return String(Math.floor(num / 100));
}

function dollarsToIntCents(dollars: string): number {
  const num = Number.parseFloat(dollars);
  if (Number.isNaN(num) || num < 0) return 0;
  return Math.round(num * 100);
}

function parseMilestones(milestoneResponse: readonly CampaignResponse['milestones'][number][]): MilestoneFormItem[] {
  return milestoneResponse.map((m) => ({
    id: m.id,
    title: m.title ?? '',
    description: m.description ?? '',
    targetDate: m.target_date ? m.target_date.split('T')[0] ?? '' : '',
    fundingPercentage: m.funding_percentage !== null ? String(m.funding_percentage) : '',
    verificationCriteria: m.verification_criteria ?? '',
  }));
}

export function CampaignForm({
  initialData,
  onSaveDraft,
  onSubmit,
  isSaving = false,
  isSubmitting = false,
  saveError = null,
  submitError = null,
  submitSuccessMessage = null,
  showSubmitButton = true,
  isReadOnly = false,
}: CampaignFormProps): ReactElement {
  const [title, setTitle] = useState(initialData?.title ?? '');
  const [category, setCategory] = useState<CampaignCategory>(
    initialData?.category ?? 'propulsion',
  );
  const [summary, setSummary] = useState(initialData?.summary ?? '');
  const [description, setDescription] = useState(initialData?.description ?? '');
  const [marsAlignmentStatement, setMarsAlignmentStatement] = useState(
    initialData?.mars_alignment_statement ?? '',
  );
  const [minFundingTargetDollars, setMinFundingTargetDollars] = useState(
    centsToDisplayDollars(initialData?.min_funding_target_cents),
  );
  const [maxFundingCapDollars, setMaxFundingCapDollars] = useState(
    centsToDisplayDollars(initialData?.max_funding_cap_cents),
  );
  const [deadline, setDeadline] = useState(
    initialData?.deadline ? initialData.deadline.split('T')[0] ?? '' : '',
  );
  const [budgetBreakdown, setBudgetBreakdown] = useState(initialData?.budget_breakdown ?? '');
  const [teamInfo, setTeamInfo] = useState(initialData?.team_info ?? '');
  const [riskDisclosures, setRiskDisclosures] = useState(initialData?.risk_disclosures ?? '');
  const [heroImageUrl, setHeroImageUrl] = useState(initialData?.hero_image_url ?? '');
  const [milestones, setMilestones] = useState<MilestoneFormItem[]>(
    initialData?.milestones ? parseMilestones([...initialData.milestones]) : [],
  );

  const isDisabled = isReadOnly || isSaving || isSubmitting;
  const summaryLength = summary.length;

  function getFormData(): CampaignFormData {
    return {
      title,
      category,
      summary,
      description,
      marsAlignmentStatement,
      minFundingTargetDollars,
      maxFundingCapDollars,
      deadline,
      budgetBreakdown,
      teamInfo,
      riskDisclosures,
      heroImageUrl,
      milestones,
    };
  }

  async function handleSaveDraft(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    await onSaveDraft(getFormData());
  }

  async function handleSubmit(): Promise<void> {
    if (onSubmit) {
      await onSubmit(getFormData());
    }
  }

  return (
    <>
      <form
        className="campaign-form"
        onSubmit={(e) => {
          void handleSaveDraft(e);
        }}
        noValidate
      >
        {/* Section 1: Mission Objectives */}
        <section className="campaign-form__section" aria-labelledby="section-mission">
          <h2 id="section-mission" className="campaign-form__section-heading">
            MISSION OBJECTIVES
          </h2>

          <div className="form-field">
            <label htmlFor="campaign-title" className="form-label">
              CAMPAIGN TITLE <span aria-hidden="true">*</span>
            </label>
            <input
              id="campaign-title"
              type="text"
              className="form-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Advanced Ion Propulsion for Faster Mars Transit"
              maxLength={200}
              disabled={isDisabled}
              aria-required="true"
            />
            <p className="form-helper">1–200 characters. Be specific and compelling.</p>
          </div>

          <div className="form-field">
            <label htmlFor="campaign-summary" className="form-label">
              SUMMARY
            </label>
            <textarea
              id="campaign-summary"
              className="form-input form-textarea"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="A brief description for the campaign listing page..."
              maxLength={280}
              rows={3}
              disabled={isDisabled}
            />
            <p className={`form-helper ${summaryLength > 260 ? 'form-helper--warning' : ''}`}>
              {summaryLength}/280 characters
            </p>
          </div>

          <div className="form-field">
            <label htmlFor="campaign-description" className="form-label">
              FULL DESCRIPTION
            </label>
            <textarea
              id="campaign-description"
              className="form-input form-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide a comprehensive description of your project..."
              maxLength={10000}
              rows={6}
              disabled={isDisabled}
            />
          </div>

          <div className="form-field">
            <label htmlFor="campaign-mars-alignment" className="form-label">
              MARS ALIGNMENT STATEMENT
            </label>
            <textarea
              id="campaign-mars-alignment"
              className="form-input form-textarea"
              value={marsAlignmentStatement}
              onChange={(e) => setMarsAlignmentStatement(e.target.value)}
              placeholder="How does this project directly contribute to humanity's mission to Mars?"
              maxLength={2000}
              rows={4}
              disabled={isDisabled}
            />
          </div>
        </section>

        {/* Section 2: Funding Details */}
        <section className="campaign-form__section" aria-labelledby="section-funding">
          <h2 id="section-funding" className="campaign-form__section-heading">
            FUNDING DETAILS
          </h2>

          <div className="form-field">
            <label htmlFor="campaign-category" className="form-label">
              CATEGORY <span aria-hidden="true">*</span>
            </label>
            <select
              id="campaign-category"
              className="form-input"
              value={category}
              onChange={(e) => setCategory(e.target.value as CampaignCategory)}
              disabled={isDisabled}
              aria-required="true"
            >
              {CAMPAIGN_CATEGORIES.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="campaign-form__two-col">
            <div className="form-field">
              <label htmlFor="campaign-min-target" className="form-label">
                MIN FUNDING TARGET (USD) <span aria-hidden="true">*</span>
              </label>
              <input
                id="campaign-min-target"
                type="number"
                className="form-input"
                value={minFundingTargetDollars}
                onChange={(e) => setMinFundingTargetDollars(e.target.value)}
                placeholder="1000000"
                min={1000000}
                disabled={isDisabled}
                aria-required="true"
              />
              <p className="form-helper">Minimum $1,000,000</p>
            </div>

            <div className="form-field">
              <label htmlFor="campaign-max-cap" className="form-label">
                MAX FUNDING CAP (USD) <span aria-hidden="true">*</span>
              </label>
              <input
                id="campaign-max-cap"
                type="number"
                className="form-input"
                value={maxFundingCapDollars}
                onChange={(e) => setMaxFundingCapDollars(e.target.value)}
                placeholder="5000000"
                min={1000000}
                disabled={isDisabled}
                aria-required="true"
              />
            </div>
          </div>

          <div className="form-field">
            <label htmlFor="campaign-deadline" className="form-label">
              CAMPAIGN DEADLINE
            </label>
            <input
              id="campaign-deadline"
              type="date"
              className="form-input"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              disabled={isDisabled}
            />
            <p className="form-helper">7 days to 1 year from submission date.</p>
          </div>

          <div className="form-field">
            <label htmlFor="campaign-budget" className="form-label">
              BUDGET BREAKDOWN
            </label>
            <textarea
              id="campaign-budget"
              className="form-input form-textarea"
              value={budgetBreakdown}
              onChange={(e) => setBudgetBreakdown(e.target.value)}
              placeholder="Describe how the funds will be allocated..."
              maxLength={5000}
              rows={3}
              disabled={isDisabled}
            />
          </div>
        </section>

        {/* Section 3: Milestone Plan */}
        <section className="campaign-form__section" aria-labelledby="section-milestones">
          <h2 id="section-milestones" className="campaign-form__section-heading">
            MILESTONE PLAN
          </h2>
          <p className="campaign-form__section-hint">
            At least 2 milestones required for submission. Funding percentages must sum to 100%.
          </p>
          <MilestoneEditor
            milestones={milestones}
            onChange={setMilestones}
            disabled={isDisabled}
          />
        </section>

        {/* Section 4: Team & Risk */}
        <section className="campaign-form__section" aria-labelledby="section-team">
          <h2 id="section-team" className="campaign-form__section-heading">
            TEAM & RISK
          </h2>

          <div className="form-field">
            <label htmlFor="campaign-team" className="form-label">
              TEAM INFORMATION
            </label>
            <textarea
              id="campaign-team"
              className="form-input form-textarea"
              value={teamInfo}
              onChange={(e) => setTeamInfo(e.target.value)}
              placeholder='JSON array of team members, e.g.: [{"name": "Dr. Jane Smith", "role": "Lead Engineer", "bio": "20 years in aerospace..."}]'
              maxLength={10000}
              rows={5}
              disabled={isDisabled}
            />
            <p className="form-helper">
              JSON array with name, role, and bio for each team member.
            </p>
          </div>

          <div className="form-field">
            <label htmlFor="campaign-risks" className="form-label">
              RISK DISCLOSURES
            </label>
            <textarea
              id="campaign-risks"
              className="form-input form-textarea"
              value={riskDisclosures}
              onChange={(e) => setRiskDisclosures(e.target.value)}
              placeholder='JSON array of risks, e.g.: [{"risk": "Technical failure", "mitigation": "Redundant systems..."}]'
              maxLength={10000}
              rows={5}
              disabled={isDisabled}
            />
            <p className="form-helper">
              JSON array with risk description and mitigation for each identified risk.
            </p>
          </div>
        </section>

        {/* Section 5: Media */}
        <section className="campaign-form__section" aria-labelledby="section-media">
          <h2 id="section-media" className="campaign-form__section-heading">
            MEDIA
          </h2>

          <div className="form-field">
            <label htmlFor="campaign-hero-url" className="form-label">
              HERO IMAGE URL
            </label>
            <input
              id="campaign-hero-url"
              type="url"
              className="form-input"
              value={heroImageUrl}
              onChange={(e) => setHeroImageUrl(e.target.value)}
              placeholder="https://..."
              maxLength={2048}
              disabled={isDisabled}
            />
            <p className="form-helper">Must be an HTTPS URL.</p>
          </div>
        </section>

        {/* Error messages */}
        {saveError && (
          <div className="campaign-form__error" role="alert">
            {saveError}
          </div>
        )}

        {submitError && (
          <div className="campaign-form__error" role="alert">
            {submitError}
          </div>
        )}

        {submitSuccessMessage && (
          <div className="campaign-form__success" role="status">
            {submitSuccessMessage}
          </div>
        )}

        {/* Form Actions */}
        {!isReadOnly && (
          <div className="campaign-form__actions">
            <button
              type="submit"
              className="btn-secondary"
              disabled={isDisabled}
              aria-busy={isSaving}
            >
              {isSaving ? (
                <>
                  <span className="btn-spinner" aria-hidden="true" />
                  <span>SAVING...</span>
                </>
              ) : (
                'SAVE DRAFT'
              )}
            </button>

            {showSubmitButton && onSubmit && (
              <button
                type="button"
                className="btn-primary"
                disabled={isDisabled}
                aria-busy={isSubmitting}
                onClick={() => { void handleSubmit(); }}
              >
                {isSubmitting ? (
                  <>
                    <span className="btn-spinner btn-spinner--light" aria-hidden="true" />
                    <span>SUBMITTING...</span>
                  </>
                ) : (
                  'SUBMIT FOR REVIEW'
                )}
              </button>
            )}
          </div>
        )}
      </form>

      <style>{`
        .campaign-form {
          display: flex;
          flex-direction: column;
          gap: 48px;
        }

        .campaign-form__section {
          display: flex;
          flex-direction: column;
          gap: 24px;
          padding-top: 32px;
          border-top: 1px solid var(--color-border-subtle);
        }

        .campaign-form__section:first-child {
          border-top: none;
          padding-top: 0;
        }

        .campaign-form__section-heading {
          font-family: var(--font-display);
          font-size: 28px;
          font-weight: 400;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--color-text-primary);
          margin: 0;
        }

        .campaign-form__section-hint {
          font-family: var(--font-body);
          font-size: 13px;
          color: var(--color-text-tertiary);
          margin: -16px 0 0;
        }

        .campaign-form__two-col {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
        }

        @media (max-width: 640px) {
          .campaign-form__two-col {
            grid-template-columns: 1fr;
          }
        }

        .form-field {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .form-label {
          font-family: var(--font-data);
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: var(--color-text-tertiary);
        }

        .form-input {
          width: 100%;
          background: var(--color-bg-input);
          border: 1px solid var(--color-border-input);
          border-radius: var(--radius-input);
          padding: 14px 16px;
          font-family: var(--font-body);
          font-size: 16px;
          font-weight: 400;
          color: var(--color-text-primary);
          box-sizing: border-box;
          transition:
            border-color 0.15s ease,
            box-shadow 0.15s ease;
          appearance: none;
        }

        .form-input:focus {
          outline: none;
          border-color: var(--color-border-emphasis);
          box-shadow: 0 0 0 3px rgba(255, 92, 26, 0.25);
        }

        .form-input:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .form-textarea {
          resize: vertical;
          min-height: 80px;
          line-height: 1.5;
        }

        .form-helper {
          font-family: var(--font-body);
          font-size: 13px;
          color: var(--color-text-tertiary);
          margin: 0;
        }

        .form-helper--warning {
          color: var(--color-status-warning);
        }

        .campaign-form__error {
          background: rgba(193, 68, 14, 0.1);
          border: 1px solid var(--color-status-error);
          border-radius: var(--radius-input);
          padding: 12px 16px;
          font-family: var(--font-body);
          font-size: 13px;
          color: var(--color-text-error, var(--color-status-error));
        }

        .campaign-form__success {
          background: rgba(0, 200, 80, 0.08);
          border: 1px solid var(--color-status-success);
          border-radius: var(--radius-input);
          padding: 12px 16px;
          font-family: var(--font-body);
          font-size: 13px;
          color: var(--color-status-success);
        }

        .campaign-form__actions {
          display: flex;
          gap: 16px;
          justify-content: flex-end;
          padding-top: 16px;
          border-top: 1px solid var(--color-border-subtle);
        }

        .btn-primary,
        .btn-secondary {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border-radius: var(--radius-button);
          font-family: var(--font-body);
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 0.05em;
          padding: 12px 28px;
          cursor: pointer;
          transition: opacity 0.15s ease;
        }

        .btn-primary {
          background: var(--gradient-action-primary);
          color: var(--color-action-primary-text);
          border: none;
          box-shadow: 0 4px 16px var(--color-action-primary-shadow);
        }

        .btn-primary:hover:not(:disabled) {
          opacity: 0.9;
        }

        .btn-primary:focus-visible {
          outline: 2px solid var(--color-action-primary-hover);
          outline-offset: 2px;
        }

        .btn-primary:disabled {
          opacity: 0.4;
          cursor: not-allowed;
          box-shadow: none;
        }

        .btn-secondary {
          background: transparent;
          border: 1px solid var(--color-border-input);
          color: var(--color-text-secondary);
        }

        .btn-secondary:hover:not(:disabled) {
          border-color: var(--color-border-emphasis);
          color: var(--color-text-primary);
        }

        .btn-secondary:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .btn-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255, 255, 255, 0.15);
          border-top-color: currentColor;
          border-radius: 50%;
          animation: btn-spin 800ms linear infinite;
          flex-shrink: 0;
        }

        @keyframes btn-spin {
          to { transform: rotate(360deg); }
        }

        @media (prefers-reduced-motion: reduce) {
          .btn-spinner { animation: none; opacity: 0.5; }
        }
      `}</style>
    </>
  );
}

export { dollarsToIntCents };
