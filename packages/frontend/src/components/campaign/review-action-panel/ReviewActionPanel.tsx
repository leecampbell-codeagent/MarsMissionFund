import { type ChangeEvent, type ReactElement, useState } from 'react';
import { Button } from '../../ui/Button';

interface ReviewActionPanelProps {
  readonly campaignId: string;
  readonly onApprove: (reviewNotes: string) => void;
  readonly onReject: (rejectionReason: string, resubmissionGuidance: string) => void;
  readonly isLoading: boolean;
}

const textareaStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--color-bg-elevated)',
  border: '1px solid var(--color-border-subtle)',
  borderRadius: 'var(--radius-input)',
  color: 'var(--color-text-primary)',
  fontFamily: 'var(--font-body)',
  fontSize: '13px',
  padding: '10px 14px',
  outline: 'none',
  resize: 'vertical',
  lineHeight: 1.5,
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontFamily: 'var(--font-body)',
  fontSize: '12px',
  fontWeight: 600,
  color: 'var(--color-text-secondary)',
  marginBottom: '6px',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

/**
 * ReviewActionPanel — approve/reject actions for assigned reviewers.
 * Both forms require non-empty content before submit is enabled.
 */
export function ReviewActionPanel({
  campaignId: _campaignId,
  onApprove,
  onReject,
  isLoading,
}: ReviewActionPanelProps): ReactElement {
  const [reviewNotes, setReviewNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [resubmissionGuidance, setResubmissionGuidance] = useState('');
  const [activeTab, setActiveTab] = useState<'approve' | 'reject'>('approve');

  const canApprove = reviewNotes.trim().length > 0;
  const canReject = rejectionReason.trim().length > 0 && resubmissionGuidance.trim().length > 0;

  const handleApprove = () => {
    if (canApprove) {
      onApprove(reviewNotes.trim());
    }
  };

  const handleReject = () => {
    if (canReject) {
      onReject(rejectionReason.trim(), resubmissionGuidance.trim());
    }
  };

  const tabStyle = (tab: 'approve' | 'reject'): React.CSSProperties => ({
    flex: 1,
    background: 'transparent',
    border: 'none',
    borderBottom: `2px solid ${activeTab === tab ? (tab === 'approve' ? 'var(--color-status-success)' : 'var(--color-status-error)') : 'var(--color-border-subtle)'}`,
    padding: '8px 12px',
    cursor: 'pointer',
    fontFamily: 'var(--font-body)',
    fontSize: '13px',
    fontWeight: 600,
    color:
      activeTab === tab
        ? tab === 'approve'
          ? 'var(--color-status-success)'
          : 'var(--color-status-error)'
        : 'var(--color-text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    transition: 'color var(--motion-hover), border-color var(--motion-hover)',
  });

  return (
    <div
      aria-label="Review actions"
      style={{
        background: 'var(--gradient-surface-card)',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 'var(--radius-card)',
        overflow: 'hidden',
      }}
    >
      {/* Tab bar */}
      <div
        role="tablist"
        style={{ display: 'flex', borderBottom: '1px solid var(--color-border-subtle)' }}
      >
        <button
          role="tab"
          aria-selected={activeTab === 'approve'}
          aria-controls="approve-panel"
          style={tabStyle('approve')}
          onClick={() => setActiveTab('approve')}
          type="button"
        >
          Approve
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'reject'}
          aria-controls="reject-panel"
          style={tabStyle('reject')}
          onClick={() => setActiveTab('reject')}
          type="button"
        >
          Reject
        </button>
      </div>

      {/* Approve form */}
      <div
        id="approve-panel"
        role="tabpanel"
        aria-label="Approve campaign"
        hidden={activeTab !== 'approve'}
        style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}
      >
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '13px',
            color: 'var(--color-text-secondary)',
            margin: 0,
          }}
        >
          Provide review notes documenting your assessment.
        </p>
        <div>
          <label htmlFor="review-notes" style={labelStyle}>
            Review Notes{' '}
            <span aria-hidden="true" style={{ color: 'var(--color-status-error)' }}>
              *
            </span>
          </label>
          <textarea
            id="review-notes"
            value={reviewNotes}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setReviewNotes(e.target.value)}
            placeholder="Document your review findings and rationale for approval..."
            rows={4}
            style={textareaStyle}
            aria-required="true"
          />
          {reviewNotes.trim().length === 0 && (
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '11px',
                color: 'var(--color-text-tertiary)',
                marginTop: '4px',
              }}
            >
              Notes are required to approve.
            </p>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="success"
            size="sm"
            onClick={handleApprove}
            disabled={!canApprove || isLoading}
            isLoading={isLoading && activeTab === 'approve'}
            aria-label="Approve this campaign"
          >
            Approve Campaign
          </Button>
        </div>
      </div>

      {/* Reject form */}
      <div
        id="reject-panel"
        role="tabpanel"
        aria-label="Reject campaign"
        hidden={activeTab !== 'reject'}
        style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}
      >
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '13px',
            color: 'var(--color-text-secondary)',
            margin: 0,
          }}
        >
          Provide clear feedback to help the creator improve their proposal.
        </p>
        <div>
          <label htmlFor="rejection-reason" style={labelStyle}>
            Rejection Reason{' '}
            <span aria-hidden="true" style={{ color: 'var(--color-status-error)' }}>
              *
            </span>
          </label>
          <textarea
            id="rejection-reason"
            value={rejectionReason}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setRejectionReason(e.target.value)}
            placeholder="What specific issues led to rejection?"
            rows={3}
            style={textareaStyle}
            aria-required="true"
          />
        </div>
        <div>
          <label htmlFor="resubmission-guidance" style={labelStyle}>
            Resubmission Guidance{' '}
            <span aria-hidden="true" style={{ color: 'var(--color-status-error)' }}>
              *
            </span>
          </label>
          <textarea
            id="resubmission-guidance"
            value={resubmissionGuidance}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
              setResubmissionGuidance(e.target.value)
            }
            placeholder="What changes would make this campaign approvable?"
            rows={3}
            style={textareaStyle}
            aria-required="true"
          />
        </div>
        {(!rejectionReason.trim() || !resubmissionGuidance.trim()) && (
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '11px',
              color: 'var(--color-text-tertiary)',
            }}
          >
            Both fields are required to reject.
          </p>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={handleReject}
            disabled={!canReject || isLoading}
            aria-label="Reject this campaign"
            style={{
              background: 'transparent',
              border: '1px solid var(--color-status-error)',
              borderRadius: 'var(--radius-button)',
              padding: '8px 16px',
              cursor: !canReject || isLoading ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font-body)',
              fontSize: '12px',
              fontWeight: 600,
              color:
                !canReject || isLoading ? 'rgba(138, 150, 168, 0.8)' : 'var(--color-status-error)',
              opacity: !canReject || isLoading ? 0.6 : 1,
            }}
          >
            {isLoading && activeTab === 'reject' ? 'Rejecting...' : 'Reject Campaign'}
          </button>
        </div>
      </div>
    </div>
  );
}
