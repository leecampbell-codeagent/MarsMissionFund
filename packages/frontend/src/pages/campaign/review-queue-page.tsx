import { type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReviewQueue } from '../../hooks/campaign/use-review-queue';
import { useCurrentUser } from '../../hooks/account/use-current-user';
import { CampaignCard } from '../../components/campaign/campaign-card/CampaignCard';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Button } from '../../components/ui/Button';

const SLA_DAYS = 5; // Campaigns older than this show an overdue indicator

function getDaysAgo(isoString: string): number {
  const ms = Date.now() - new Date(isoString).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

/**
 * ReviewQueuePage — /review-queue
 * Shows submitted campaigns in FIFO order for Reviewers and Admins.
 */
export default function ReviewQueuePage(): ReactElement {
  const navigate = useNavigate();
  const { user, isLoading: userLoading } = useCurrentUser();
  const { campaigns, isLoading, isError, error } = useReviewQueue();

  const isReviewer = user?.roles.includes('reviewer') ?? false;
  const isAdmin = user?.roles.includes('administrator') ?? false;
  const hasAccess = isReviewer || isAdmin;

  if (userLoading || isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--color-bg-page)' }}>
        <LoadingSpinner size="lg" label="Loading review queue" />
      </div>
    );
  }

  // Role check — redirect if no access
  if (!hasAccess) {
    return (
      <div style={{ background: 'var(--color-bg-page)', minHeight: '100vh', padding: '48px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', maxWidth: '400px' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '32px', textTransform: 'uppercase', color: 'var(--color-text-primary)', margin: '0 0 16px' }}>
            Access Restricted
          </h1>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--color-text-secondary)', margin: '0 0 24px' }}>
            The review queue is only accessible to Reviewers and Administrators.
          </p>
          <Button variant="secondary" onClick={() => navigate('/')}>
            Return Home
          </Button>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div style={{ background: 'var(--color-bg-page)', minHeight: '100vh', padding: '48px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', maxWidth: '400px' }}>
          <p role="alert" style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--color-status-error)', marginBottom: '16px' }}>
            {error?.message ?? 'Failed to load review queue.'}
          </p>
          <Button variant="secondary" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const overdueCount = campaigns.filter(
    (c) => c.submittedAt && getDaysAgo(c.submittedAt) > SLA_DAYS,
  ).length;

  return (
    <div style={{ background: 'var(--color-bg-page)', minHeight: '100vh', padding: '48px 24px' }}>
      <div style={{ maxWidth: '960px', margin: '0 auto' }}>

        {/* Page header */}
        <div style={{ marginBottom: '40px' }}>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-accent)', margin: '0 0 8px' }}>
            Review Pipeline
          </p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '40px', textTransform: 'uppercase', color: 'var(--color-text-primary)', margin: '0 0 8px', lineHeight: 1 }}>
            Review Queue
          </h1>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--font-data)', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
              {campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''} awaiting review
            </span>
            {overdueCount > 0 && (
              <span
                style={{
                  fontFamily: 'var(--font-data)',
                  fontSize: '12px',
                  color: 'var(--color-status-error)',
                  background: 'color-mix(in srgb, var(--color-status-error) 15%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--color-status-error) 30%, transparent)',
                  borderRadius: 'var(--radius-pill)',
                  padding: '2px 10px',
                }}
              >
                {overdueCount} overdue (&gt;{SLA_DAYS} days)
              </span>
            )}
          </div>
        </div>

        {/* Empty state — not an error (EC-031) */}
        {campaigns.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '80px 24px',
              background: 'var(--gradient-surface-card)',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 'var(--radius-card)',
            }}
          >
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '24px', textTransform: 'uppercase', color: 'var(--color-text-primary)', margin: '0 0 8px' }}>
              Queue is Clear
            </p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--color-text-secondary)', margin: 0 }}>
              No campaigns awaiting review.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {campaigns.map((campaign, index) => {
              const daysAgo = campaign.submittedAt ? getDaysAgo(campaign.submittedAt) : 0;
              const isOverdue = campaign.submittedAt && daysAgo > SLA_DAYS;

              return (
                <div key={campaign.id} style={{ position: 'relative' }}>
                  {isOverdue && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '8px',
                        right: '8px',
                        fontFamily: 'var(--font-data)',
                        fontSize: '11px',
                        color: 'var(--color-status-error)',
                        zIndex: 1,
                        background: 'var(--color-bg-elevated)',
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-pill)',
                        border: '1px solid color-mix(in srgb, var(--color-status-error) 30%, transparent)',
                      }}
                      aria-label={`Overdue by ${daysAgo - SLA_DAYS} days`}
                    >
                      {daysAgo}d ago — overdue
                    </div>
                  )}
                  <div
                    style={{
                      display: 'flex',
                      gap: '12px',
                      alignItems: 'flex-start',
                      borderBottom: index < campaigns.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
                      padding: '4px 0',
                    }}
                  >
                    {/* FIFO position indicator */}
                    <div
                      aria-hidden="true"
                      style={{
                        flexShrink: 0,
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: 'var(--color-bg-elevated)',
                        border: '1px solid var(--color-border-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontFamily: 'var(--font-data)',
                        fontSize: '12px',
                        color: 'var(--color-text-tertiary)',
                        marginTop: '28px',
                      }}
                    >
                      {index + 1}
                    </div>
                    <div style={{ flex: 1 }}>
                      <CampaignCard
                        campaign={campaign}
                        onClick={() => navigate(`/campaigns/${campaign.id}`)}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
