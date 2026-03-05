import type { ReactElement } from 'react';

export interface MilestoneFormItem {
  readonly id: string; // local key for React key prop
  readonly title: string;
  readonly description: string;
  readonly targetDate: string;
  readonly fundingPercentage: string;
  readonly verificationCriteria: string;
}

interface MilestoneEditorProps {
  readonly milestones: readonly MilestoneFormItem[];
  readonly onChange: (milestones: MilestoneFormItem[]) => void;
  readonly disabled?: boolean;
}

export function MilestoneEditor({ milestones, onChange, disabled = false }: MilestoneEditorProps): ReactElement {
  const totalPercentage = milestones.reduce((sum, m) => {
    const pct = Number.parseInt(m.fundingPercentage, 10);
    return sum + (Number.isNaN(pct) ? 0 : pct);
  }, 0);

  const isValid = totalPercentage === 100;

  function addMilestone(): void {
    const newMilestone: MilestoneFormItem = {
      id: crypto.randomUUID(),
      title: '',
      description: '',
      targetDate: '',
      fundingPercentage: '',
      verificationCriteria: '',
    };
    onChange([...milestones, newMilestone]);
  }

  function removeMilestone(id: string): void {
    onChange(milestones.filter((m) => m.id !== id));
  }

  function updateMilestone(id: string, field: keyof MilestoneFormItem, value: string): void {
    onChange(
      milestones.map((m) =>
        m.id === id ? { ...m, [field]: value } : m,
      ),
    );
  }

  return (
    <>
      <div className="milestone-editor">
        {milestones.length > 0 && (
          <div
            className={`milestone-total ${isValid ? 'milestone-total--valid' : 'milestone-total--invalid'}`}
            aria-live="polite"
          >
            TOTAL: {totalPercentage}% / 100%
            {!isValid && milestones.length >= 2 && (
              <span className="milestone-total__hint"> — must equal 100%</span>
            )}
          </div>
        )}

        {milestones.map((milestone, index) => (
          <div key={milestone.id} className="milestone-row">
            <div className="milestone-row__header">
              <span className="milestone-row__label">MILESTONE {index + 1}</span>
              {milestones.length > 1 && (
                <button
                  type="button"
                  className="milestone-row__remove"
                  onClick={() => removeMilestone(milestone.id)}
                  disabled={disabled}
                  aria-label={`Remove milestone ${index + 1}`}
                >
                  REMOVE
                </button>
              )}
            </div>

            <div className="milestone-row__fields">
              <div className="form-field">
                <label htmlFor={`milestone-title-${milestone.id}`} className="form-label">
                  MILESTONE TITLE <span aria-hidden="true">*</span>
                </label>
                <input
                  id={`milestone-title-${milestone.id}`}
                  type="text"
                  className="form-input"
                  value={milestone.title}
                  onChange={(e) => updateMilestone(milestone.id, 'title', e.target.value)}
                  placeholder="e.g., Prototype Development Complete"
                  maxLength={200}
                  disabled={disabled}
                  aria-required="true"
                />
              </div>

              <div className="milestone-row__two-col">
                <div className="form-field">
                  <label htmlFor={`milestone-date-${milestone.id}`} className="form-label">
                    TARGET DATE <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id={`milestone-date-${milestone.id}`}
                    type="date"
                    className="form-input"
                    value={milestone.targetDate}
                    onChange={(e) => updateMilestone(milestone.id, 'targetDate', e.target.value)}
                    disabled={disabled}
                    aria-required="true"
                  />
                </div>

                <div className="form-field">
                  <label htmlFor={`milestone-pct-${milestone.id}`} className="form-label">
                    FUNDING % <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id={`milestone-pct-${milestone.id}`}
                    type="number"
                    className="form-input"
                    value={milestone.fundingPercentage}
                    onChange={(e) => updateMilestone(milestone.id, 'fundingPercentage', e.target.value)}
                    min={0}
                    max={100}
                    placeholder="e.g., 50"
                    disabled={disabled}
                    aria-required="true"
                  />
                </div>
              </div>

              <div className="form-field">
                <label htmlFor={`milestone-criteria-${milestone.id}`} className="form-label">
                  VERIFICATION CRITERIA
                </label>
                <textarea
                  id={`milestone-criteria-${milestone.id}`}
                  className="form-input form-textarea"
                  value={milestone.verificationCriteria}
                  onChange={(e) =>
                    updateMilestone(milestone.id, 'verificationCriteria', e.target.value)
                  }
                  placeholder="How will this milestone be verified?"
                  rows={2}
                  maxLength={2000}
                  disabled={disabled}
                />
              </div>
            </div>
          </div>
        ))}

        <button
          type="button"
          className="milestone-add-btn"
          onClick={addMilestone}
          disabled={disabled}
          aria-label="Add milestone"
        >
          + ADD MILESTONE
        </button>
      </div>

      <style>{`
        .milestone-editor {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .milestone-total {
          font-family: var(--font-data);
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.05em;
          padding: 8px 12px;
          border-radius: var(--radius-input);
          border: 1px solid currentColor;
        }

        .milestone-total--valid {
          color: var(--color-status-success);
          background: rgba(0, 200, 80, 0.06);
        }

        .milestone-total--invalid {
          color: var(--color-status-error);
          background: rgba(193, 68, 14, 0.06);
        }

        .milestone-total__hint {
          font-weight: 400;
          opacity: 0.8;
        }

        .milestone-row {
          background: var(--color-bg-card, rgba(255,255,255,0.03));
          border: 1px solid var(--color-border-subtle);
          border-radius: var(--radius-card, 8px);
          padding: 16px;
        }

        .milestone-row__header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .milestone-row__label {
          font-family: var(--font-data);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.3em;
          color: var(--color-text-accent);
        }

        .milestone-row__remove {
          font-family: var(--font-data);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.1em;
          color: var(--color-status-error);
          background: none;
          border: 1px solid var(--color-status-error);
          border-radius: 4px;
          padding: 4px 10px;
          cursor: pointer;
          transition: opacity 0.15s ease;
        }

        .milestone-row__remove:hover:not(:disabled) {
          opacity: 0.8;
        }

        .milestone-row__remove:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .milestone-row__fields {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .milestone-row__two-col {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        @media (max-width: 640px) {
          .milestone-row__two-col {
            grid-template-columns: 1fr;
          }
        }

        .milestone-add-btn {
          font-family: var(--font-data);
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.1em;
          color: var(--color-text-accent);
          background: none;
          border: 1px solid var(--color-border-input);
          border-radius: var(--radius-button);
          padding: 12px 24px;
          cursor: pointer;
          transition: border-color 0.15s ease, color 0.15s ease;
          align-self: flex-start;
        }

        .milestone-add-btn:hover:not(:disabled) {
          border-color: var(--color-text-accent);
        }

        .milestone-add-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
      `}</style>
    </>
  );
}
