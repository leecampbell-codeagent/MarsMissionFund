import { useState, type ReactElement } from 'react';
import { RejectionReasonModal } from '../components/campaign/RejectionReasonModal';
import { ReviewQueueCard } from '../components/campaign/ReviewQueueCard';
import { useApproveCampaign } from '../hooks/campaign/use-approve-campaign';
import { useRejectCampaign } from '../hooks/campaign/use-reject-campaign';
import { useReviewQueue } from '../hooks/campaign/use-review-queue';
import { useStartReview } from '../hooks/campaign/use-start-review';
import { useAccount } from '../hooks/account/use-account';

export default function ReviewQueuePage(): ReactElement {
  const { data: campaigns, isLoading, isError } = useReviewQueue();
  const { data: account } = useAccount();
  const startReview = useStartReview();
  const approveCampaign = useApproveCampaign();
  const rejectCampaign = useRejectCampaign();

  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);

  const currentUserId = account?.id;

  const handleClaim = (campaignId: string) => {
    startReview.mutate(campaignId);
  };

  const handleApprove = (campaignId: string) => {
    approveCampaign.mutate({
      campaignId,
      comment: 'Campaign approved. Meets all curation criteria for Mars Mission Fund.',
    });
  };

  const handleRejectClick = (campaignId: string) => {
    setRejectTargetId(campaignId);
  };

  const handleRejectConfirm = (comment: string) => {
    if (!rejectTargetId) return;
    rejectCampaign.mutate(
      { campaignId: rejectTargetId, comment },
      {
        onSuccess: () => {
          setRejectTargetId(null);
        },
      },
    );
  };

  const handleRejectModalClose = () => {
    if (!rejectCampaign.isPending) {
      setRejectTargetId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="rq-page">
        <div className="rq-page__content">
          <div className="rq-skeleton rq-skeleton--label" />
          <div className="rq-skeleton rq-skeleton--heading" />
          <div className="rq-list">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rq-skeleton rq-skeleton--card" />
            ))}
          </div>
        </div>
        <ReviewQueuePageStyle />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rq-page">
        <div className="rq-page__content">
          <p className="rq-section-label">REVIEW QUEUE</p>
          <h1 className="rq-heading">MISSION REVIEW BOARD</h1>
          <div className="rq-error" role="alert">
            Failed to load review queue. Please try again.
          </div>
        </div>
        <ReviewQueuePageStyle />
      </div>
    );
  }

  const queue = campaigns ?? [];

  return (
    <div className="rq-page">
      <div className="rq-page__content">
        <p className="rq-section-label">REVIEW QUEUE</p>
        <h1 className="rq-heading">MISSION REVIEW BOARD</h1>

        {queue.length === 0 ? (
          <div className="rq-empty">
            <h2 className="rq-empty__heading">QUEUE IS CLEAR</h2>
            <p className="rq-empty__body">All submitted campaigns have been reviewed.</p>
          </div>
        ) : (
          <div className="rq-list">
            {queue.map((campaign) => (
              <ReviewQueueCard
                key={campaign.id}
                campaign={campaign}
                currentUserId={currentUserId}
                onClaim={() => handleClaim(campaign.id)}
                onApprove={() => handleApprove(campaign.id)}
                onReject={() => handleRejectClick(campaign.id)}
                isClaimPending={startReview.isPending && startReview.variables === campaign.id}
                isApprovePending={
                  approveCampaign.isPending &&
                  approveCampaign.variables?.campaignId === campaign.id
                }
                isRejectPending={rejectTargetId === campaign.id && rejectCampaign.isPending}
              />
            ))}
          </div>
        )}
      </div>

      <RejectionReasonModal
        isOpen={rejectTargetId !== null}
        onClose={handleRejectModalClose}
        onConfirm={handleRejectConfirm}
        isPending={rejectCampaign.isPending}
      />

      <ReviewQueuePageStyle />
    </div>
  );
}

function ReviewQueuePageStyle(): ReactElement {
  return (
    <style>{`
      .rq-page {
        display: flex;
        justify-content: center;
        flex: 1;
        padding: 24px 16px;
      }

      @media (min-width: 768px) {
        .rq-page { padding: 32px 24px; }
      }

      @media (min-width: 1024px) {
        .rq-page { padding: 48px 32px; }
      }

      .rq-page__content {
        max-width: 900px;
        width: 100%;
      }

      .rq-section-label {
        font-family: var(--font-data);
        font-size: 11px;
        font-weight: 400;
        letter-spacing: 0.3em;
        text-transform: uppercase;
        color: var(--color-text-accent);
        margin-bottom: 12px;
      }

      .rq-heading {
        font-family: var(--font-display);
        font-size: 48px;
        font-weight: 400;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--color-text-primary);
        line-height: 1;
        margin: 0 0 32px;
      }

      @media (min-width: 640px) {
        .rq-heading { font-size: 64px; }
      }

      .rq-list {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .rq-error {
        background: rgba(193, 68, 14, 0.1);
        border: 1px solid var(--color-status-error);
        border-radius: var(--radius-input);
        padding: 16px;
        font-family: var(--font-body);
        font-size: 14px;
        color: var(--color-status-error);
      }

      .rq-empty {
        text-align: center;
        padding: 80px 24px;
      }

      .rq-empty__heading {
        font-family: var(--font-display);
        font-size: 40px;
        font-weight: 400;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--color-text-primary);
        margin-bottom: 16px;
      }

      .rq-empty__body {
        font-family: var(--font-body);
        font-size: 16px;
        color: var(--color-text-secondary);
      }

      .rq-skeleton {
        background: var(--color-bg-input);
        border-radius: var(--radius-input);
        animation: rq-skel-pulse 1.5s ease-in-out infinite alternate;
      }

      @keyframes rq-skel-pulse {
        from { opacity: 0.5; }
        to { opacity: 1; }
      }

      @media (prefers-reduced-motion: reduce) {
        .rq-skeleton { animation: none; opacity: 0.7; }
      }

      .rq-skeleton--label { height: 14px; width: 100px; margin-bottom: 16px; }
      .rq-skeleton--heading { height: 56px; width: 320px; margin-bottom: 32px; }
      .rq-skeleton--card { height: 180px; width: 100%; border-radius: 12px; }
    `}</style>
  );
}
