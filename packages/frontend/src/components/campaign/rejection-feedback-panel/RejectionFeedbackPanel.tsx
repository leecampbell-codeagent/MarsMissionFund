import { type ReactElement } from 'react';

interface RejectionFeedbackPanelProps {
  readonly rejectionReason: string;
  readonly resubmissionGuidance: string;
  readonly reviewedAt: string | null;
}

/**
 * RejectionFeedbackPanel — shows rejection reason and resubmission guidance to the campaign creator.
 * Shown only when campaign status === 'rejected' and viewer is the creator.
 */
export function RejectionFeedbackPanel({
  rejectionReason,
  resubmissionGuidance,
  reviewedAt,
}: RejectionFeedbackPanelProps): ReactElement {
  return (
    <div
      aria-label="Rejection feedback"
      role="region"
      style={{
        background: 'color-mix(in srgb, var(--color-status-error) 8%, transparent)',
        border: '1px solid color-mix(in srgb, var(--color-status-error) 30%, transparent)',
        borderTop: '3px solid var(--color-status-error)',
        borderRadius: 'var(--radius-card)',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '20px',
            textTransform: 'uppercase',
            color: 'var(--color-status-error)',
            margin: 0,
          }}
        >
          Campaign Rejected
        </h3>
        {reviewedAt && (
          <span
            style={{
              fontFamily: 'var(--font-data)',
              fontSize: '11px',
              color: 'var(--color-text-tertiary)',
            }}
          >
            {new Intl.DateTimeFormat('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            }).format(new Date(reviewedAt))}
          </span>
        )}
      </div>

      {/* Rejection reason */}
      <div>
        <h4
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '13px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--color-status-error)',
            margin: '0 0 8px',
          }}
        >
          Reason for Rejection
        </h4>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '14px',
            color: 'var(--color-text-primary)',
            margin: 0,
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
          }}
        >
          {rejectionReason}
        </p>
      </div>

      {/* Resubmission guidance */}
      <div>
        <h4
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '13px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--color-text-secondary)',
            margin: '0 0 8px',
          }}
        >
          How to Improve Your Proposal
        </h4>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '14px',
            color: 'var(--color-text-primary)',
            margin: 0,
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
          }}
        >
          {resubmissionGuidance}
        </p>
      </div>

      {/* Action hint */}
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '13px',
          color: 'var(--color-text-secondary)',
          margin: 0,
          padding: '12px',
          background: 'var(--color-bg-elevated)',
          borderRadius: 'var(--radius-input)',
        }}
      >
        Address the feedback above, then click <strong>Edit Campaign</strong> to revise your proposal and resubmit.
      </p>
    </div>
  );
}
