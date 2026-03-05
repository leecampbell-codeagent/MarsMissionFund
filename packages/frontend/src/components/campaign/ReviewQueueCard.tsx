import type { ReactElement } from 'react';
import type { CampaignResponse } from '../../api/campaign-api';
import { CampaignStatusBadge } from './CampaignStatusBadge';

const CATEGORY_LABELS: Readonly<Record<string, string>> = {
  propulsion: 'PROPULSION',
  entry_descent_landing: 'ENTRY, DESCENT & LANDING',
  power_energy: 'POWER & ENERGY',
  habitats_construction: 'HABITATS & CONSTRUCTION',
  life_support_crew_health: 'LIFE SUPPORT & CREW HEALTH',
  food_water_production: 'FOOD & WATER PRODUCTION',
  isru: 'ISRU',
  radiation_protection: 'RADIATION PROTECTION',
  robotics_automation: 'ROBOTICS & AUTOMATION',
  communications_navigation: 'COMMUNICATIONS & NAVIGATION',
};

interface ReviewQueueCardProps {
  readonly campaign: CampaignResponse;
  readonly currentUserId?: string;
  readonly onClaim?: () => void;
  readonly onApprove?: () => void;
  readonly onReject?: () => void;
  readonly onRecuse?: () => void;
  readonly isClaimPending?: boolean;
  readonly isApprovePending?: boolean;
  readonly isRejectPending?: boolean;
  readonly isRecusePending?: boolean;
}

export function ReviewQueueCard({
  campaign,
  currentUserId,
  onClaim,
  onApprove,
  onReject,
  onRecuse,
  isClaimPending = false,
  isApprovePending = false,
  isRejectPending = false,
  isRecusePending = false,
}: ReviewQueueCardProps): ReactElement {
  const isSubmitted = campaign.status === 'submitted';
  const isUnderReview = campaign.status === 'under_review';
  const isAssignedReviewer = isUnderReview && campaign.reviewer_id === currentUserId;

  const submittedAt = campaign.updated_at
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(campaign.updated_at))
    : null;

  return (
    <>
      <article className="rq-card">
        <div className="rq-card__header">
          <div className="rq-card__badges">
            <CampaignStatusBadge status={campaign.status} />
            <span className="rq-card__category">
              {CATEGORY_LABELS[campaign.category] ?? campaign.category.toUpperCase()}
            </span>
          </div>
        </div>

        <h2 className="rq-card__title">{campaign.title}</h2>

        {campaign.summary && (
          <p className="rq-card__summary">{campaign.summary}</p>
        )}

        <dl className="rq-card__meta">
          <div className="rq-card__meta-item">
            <dt className="rq-card__meta-label">SUBMITTED</dt>
            <dd className="rq-card__meta-value">{submittedAt ?? '—'}</dd>
          </div>
          {isUnderReview && campaign.reviewer_id && (
            <div className="rq-card__meta-item">
              <dt className="rq-card__meta-label">REVIEWER</dt>
              <dd className="rq-card__meta-value rq-card__meta-value--muted">
                {isAssignedReviewer ? 'You' : 'Another reviewer'}
              </dd>
            </div>
          )}
        </dl>

        <div className="rq-card__actions">
          {isSubmitted && onClaim && (
            <button
              type="button"
              className="rq-card__btn rq-card__btn--primary"
              onClick={onClaim}
              disabled={isClaimPending}
              aria-label={`Claim campaign: ${campaign.title}`}
            >
              {isClaimPending ? 'CLAIMING...' : 'CLAIM CAMPAIGN'}
            </button>
          )}
          {isAssignedReviewer && (
            <>
              <button
                type="button"
                className="rq-card__btn rq-card__btn--approve"
                onClick={onApprove}
                disabled={isApprovePending || isRejectPending || isRecusePending}
                aria-label={`Approve campaign: ${campaign.title}`}
              >
                {isApprovePending ? 'APPROVING...' : 'APPROVE'}
              </button>
              <button
                type="button"
                className="rq-card__btn rq-card__btn--reject"
                onClick={onReject}
                disabled={isRejectPending || isApprovePending || isRecusePending}
                aria-label={`Reject campaign: ${campaign.title}`}
              >
                {isRejectPending ? 'REJECTING...' : 'REJECT'}
              </button>
              <button
                type="button"
                className="rq-card__btn rq-card__btn--recuse"
                onClick={onRecuse}
                disabled={isRecusePending || isApprovePending || isRejectPending}
                aria-label={`Recuse from campaign: ${campaign.title}`}
              >
                {isRecusePending ? 'RECUSING...' : 'RECUSE'}
              </button>
            </>
          )}
        </div>
      </article>

      <style>{`
        .rq-card {
          background: var(--gradient-surface-card, linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%));
          border: 1px solid var(--color-border-subtle);
          border-radius: 12px;
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          transition: border-color 0.15s ease;
        }

        @media (prefers-reduced-motion: reduce) {
          .rq-card { transition: none; }
        }

        .rq-card:hover {
          border-color: var(--color-border-emphasis, rgba(255, 92, 26, 0.3));
        }

        .rq-card__header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }

        .rq-card__badges {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .rq-card__category {
          font-family: var(--font-data);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: var(--color-text-tertiary);
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid var(--color-border-subtle);
          border-radius: 100px;
          padding: 3px 8px;
        }

        .rq-card__title {
          font-family: var(--font-display);
          font-size: 22px;
          font-weight: 400;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--color-text-primary);
          line-height: 1.1;
          margin: 0;
        }

        .rq-card__summary {
          font-family: var(--font-body);
          font-size: 14px;
          color: var(--color-text-secondary);
          line-height: 1.5;
          margin: 0;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .rq-card__meta {
          display: flex;
          gap: 24px;
          margin: 4px 0 0;
        }

        .rq-card__meta-item {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .rq-card__meta-label {
          font-family: var(--font-data);
          font-size: 10px;
          letter-spacing: 0.15em;
          color: var(--color-text-tertiary);
        }

        .rq-card__meta-value {
          font-family: var(--font-data);
          font-size: 13px;
          font-weight: 600;
          color: var(--color-text-primary);
        }

        .rq-card__meta-value--muted {
          color: var(--color-text-secondary);
          font-weight: 400;
        }

        .rq-card__actions {
          margin-top: 8px;
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .rq-card__btn {
          display: inline-block;
          font-family: var(--font-data);
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.1em;
          padding: 8px 20px;
          border-radius: var(--radius-button);
          cursor: pointer;
          transition: opacity 0.15s ease;
          border: none;
        }

        @media (prefers-reduced-motion: reduce) {
          .rq-card__btn { transition: none; }
        }

        .rq-card__btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .rq-card__btn:focus-visible {
          outline: 2px solid var(--color-text-accent);
          outline-offset: 2px;
        }

        .rq-card__btn--primary {
          background: var(--gradient-action-primary);
          color: var(--color-action-primary-text);
          box-shadow: 0 2px 8px var(--color-action-primary-shadow);
        }

        .rq-card__btn--primary:hover:not(:disabled) {
          opacity: 0.9;
        }

        .rq-card__btn--approve {
          background: rgba(0, 200, 80, 0.1);
          border: 1px solid var(--color-status-success);
          color: var(--color-status-success);
        }

        .rq-card__btn--approve:hover:not(:disabled) {
          opacity: 0.85;
        }

        .rq-card__btn--reject {
          background: transparent;
          border: 1px solid var(--color-status-error);
          color: var(--color-status-error);
        }

        .rq-card__btn--reject:hover:not(:disabled) {
          opacity: 0.85;
        }

        .rq-card__btn--recuse {
          background: transparent;
          border: 1px solid var(--color-border-subtle);
          color: var(--color-text-tertiary);
        }

        .rq-card__btn--recuse:hover:not(:disabled) {
          opacity: 0.8;
        }
      `}</style>
    </>
  );
}
