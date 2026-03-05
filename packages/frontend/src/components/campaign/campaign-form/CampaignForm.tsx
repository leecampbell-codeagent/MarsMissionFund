import { type ReactElement, useCallback, useRef, useState } from 'react';
import type { ApiError } from '../../../api/client';
import type {
  BudgetItem,
  Campaign,
  Milestone,
  RiskDisclosure,
  TeamMember,
  UpdateCampaignInput,
} from '../../../types/campaign';
import { BasicsSection } from './BasicsSection';
import { BudgetSection } from './BudgetSection';
import { DetailsSection } from './DetailsSection';
import { FundingSection } from './FundingSection';
import { MilestonesSection } from './MilestonesSection';
import { ReviewSubmitSection } from './ReviewSubmitSection';
import { RiskSection } from './RiskSection';
import { TeamSection } from './TeamSection';

type SectionId =
  | 'basics'
  | 'details'
  | 'funding'
  | 'team'
  | 'milestones'
  | 'risk'
  | 'budget'
  | 'review';

interface Section {
  readonly id: SectionId;
  readonly label: string;
  readonly optional?: boolean;
}

const SECTIONS: Section[] = [
  { id: 'basics', label: 'Basics' },
  { id: 'details', label: 'Details' },
  { id: 'funding', label: 'Funding' },
  { id: 'team', label: 'Team' },
  { id: 'milestones', label: 'Milestones' },
  { id: 'risk', label: 'Risk' },
  { id: 'budget', label: 'Budget', optional: true },
  { id: 'review', label: 'Review & Submit' },
];

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface CampaignFormProps {
  readonly campaign: Campaign;
  readonly onUpdate: (id: string, input: UpdateCampaignInput) => Promise<Campaign>;
  readonly onSubmit: (id: string) => Promise<Campaign>;
  readonly isSubmitting: boolean;
  readonly submitError: ApiError | null;
}

/**
 * CampaignForm — multi-section campaign draft form with auto-save.
 * Sections can be navigated freely. Each section auto-saves on field change with 500ms debounce.
 */
export function CampaignForm({
  campaign,
  onUpdate,
  onSubmit,
  isSubmitting,
  submitError,
}: CampaignFormProps): ReactElement {
  const [activeSection, setActiveSection] = useState<SectionId>('basics');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [localCampaign, setLocalCampaign] = useState<Campaign>(campaign);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveRef = useRef<UpdateCampaignInput | null>(null);
  const isSavingRef = useRef(false);

  const triggerSave = useCallback(
    async (input: UpdateCampaignInput) => {
      if (isSavingRef.current) {
        pendingSaveRef.current = { ...pendingSaveRef.current, ...input };
        return;
      }

      isSavingRef.current = true;
      setSaveStatus('saving');
      try {
        await onUpdate(localCampaign.id, input);
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);

        // Flush any pending saves that accumulated while we were saving
        if (pendingSaveRef.current) {
          const pending = pendingSaveRef.current;
          pendingSaveRef.current = null;
          isSavingRef.current = false;
          void triggerSave(pending);
          return;
        }
      } catch {
        setSaveStatus('error');
      } finally {
        isSavingRef.current = false;
      }
    },
    [localCampaign.id, onUpdate],
  );

  const handleChange = useCallback(
    (field: string, value: unknown) => {
      setLocalCampaign((prev) => ({ ...prev, [field]: value }));

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        void triggerSave({ [field]: value } as UpdateCampaignInput);
      }, 500);
    },
    [triggerSave],
  );

  const handleStringChange = (field: string, value: string | null) => handleChange(field, value);
  const handleMilestonesChange = (field: string, value: Milestone[]) => handleChange(field, value);
  const handleTeamChange = (field: string, value: TeamMember[]) => handleChange(field, value);
  const handleRiskChange = (field: string, value: RiskDisclosure[]) => handleChange(field, value);
  const handleBudgetChange = (field: string, value: BudgetItem[]) => handleChange(field, value);

  const handleSubmit = async () => {
    await onSubmit(localCampaign.id);
  };

  const saveStatusText: Record<SaveStatus, string> = {
    idle: '',
    saving: 'Saving...',
    saved: 'Saved',
    error: 'Failed to save',
  };

  const saveStatusColor: Record<SaveStatus, string> = {
    idle: 'var(--color-text-tertiary)',
    saving: 'var(--color-text-tertiary)',
    saved: 'var(--color-status-success)',
    error: 'var(--color-status-error)',
  };

  return (
    <div style={{ display: 'flex', gap: '40px', alignItems: 'flex-start' }}>
      {/* Section navigation — sticky side nav on desktop */}
      <nav
        aria-label="Campaign form sections"
        style={{
          width: '200px',
          flexShrink: 0,
          position: 'sticky',
          top: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}
      >
        {SECTIONS.map((section) => {
          const isActive = activeSection === section.id;
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => setActiveSection(section.id)}
              aria-current={isActive ? 'step' : undefined}
              style={{
                background: 'transparent',
                border: 'none',
                borderLeft: isActive
                  ? '2px solid var(--color-action-primary)'
                  : '2px solid transparent',
                padding: '8px 12px',
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: 'var(--font-body)',
                fontSize: '13px',
                color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                fontWeight: isActive ? 600 : 400,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
                transition: 'color var(--motion-hover)',
              }}
            >
              <span>{section.label}</span>
              {section.optional && (
                <span style={{ fontSize: '10px', color: 'var(--color-text-tertiary)' }}>opt</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Main form content */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Auto-save status bar */}
        {saveStatus !== 'idle' && (
          <div
            aria-live="polite"
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '12px',
              color: saveStatusColor[saveStatus],
              textAlign: 'right',
              minHeight: '20px',
            }}
          >
            {saveStatusText[saveStatus]}
          </div>
        )}

        {/* Active section */}
        {activeSection === 'basics' && (
          <BasicsSection campaign={localCampaign} onChange={handleStringChange} />
        )}
        {activeSection === 'details' && (
          <DetailsSection campaign={localCampaign} onChange={handleStringChange} />
        )}
        {activeSection === 'funding' && (
          <FundingSection campaign={localCampaign} onChange={handleStringChange} />
        )}
        {activeSection === 'team' && (
          <TeamSection campaign={localCampaign} onChange={handleTeamChange} />
        )}
        {activeSection === 'milestones' && (
          <MilestonesSection campaign={localCampaign} onChange={handleMilestonesChange} />
        )}
        {activeSection === 'risk' && (
          <RiskSection campaign={localCampaign} onChange={handleRiskChange} />
        )}
        {activeSection === 'budget' && (
          <BudgetSection campaign={localCampaign} onChange={handleBudgetChange} />
        )}
        {activeSection === 'review' && (
          <ReviewSubmitSection
            campaign={localCampaign}
            onSubmit={() => {
              void handleSubmit();
            }}
            isSubmitting={isSubmitting}
            submitError={submitError}
          />
        )}

        {/* Section navigation buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
          {SECTIONS.findIndex((s) => s.id === activeSection) > 0 ? (
            <button
              type="button"
              onClick={() => {
                const idx = SECTIONS.findIndex((s) => s.id === activeSection);
                const prev = SECTIONS[idx - 1];
                if (idx > 0 && prev) setActiveSection(prev.id);
              }}
              style={{
                background: 'transparent',
                border: '1px solid var(--color-border-subtle)',
                borderRadius: 'var(--radius-button)',
                padding: '10px 20px',
                fontFamily: 'var(--font-body)',
                fontSize: '13px',
                color: 'var(--color-text-secondary)',
                cursor: 'pointer',
              }}
            >
              ← Previous
            </button>
          ) : (
            <div />
          )}

          {SECTIONS.findIndex((s) => s.id === activeSection) < SECTIONS.length - 1 && (
            <button
              type="button"
              onClick={() => {
                const idx = SECTIONS.findIndex((s) => s.id === activeSection);
                const next = SECTIONS[idx + 1];
                if (idx < SECTIONS.length - 1 && next) setActiveSection(next.id);
              }}
              style={{
                background: 'var(--gradient-action-primary)',
                border: 'none',
                borderRadius: 'var(--radius-button)',
                padding: '10px 20px',
                fontFamily: 'var(--font-body)',
                fontSize: '13px',
                color: 'var(--color-action-primary-text)',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Next →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
