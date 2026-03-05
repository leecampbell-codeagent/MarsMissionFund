import { type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMyCampaigns } from '../../hooks/campaign/use-my-campaigns';
import { CampaignCard } from '../../components/campaign/campaign-card/CampaignCard';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Button } from '../../components/ui/Button';

/**
 * MyCampaignsPage — /me/campaigns
 * Shows the authenticated creator's campaign portfolio.
 */
export default function MyCampaignsPage(): ReactElement {
  const navigate = useNavigate();
  const { campaigns, isLoading, isError, error } = useMyCampaigns();

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--color-bg-page)' }}>
        <LoadingSpinner size="lg" label="Loading campaigns" />
      </div>
    );
  }

  if (isError) {
    return (
      <div style={{ background: 'var(--color-bg-page)', minHeight: '100vh', padding: '48px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', maxWidth: '400px' }}>
          <p
            role="alert"
            style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--color-status-error)', marginBottom: '16px' }}
          >
            {error?.message ?? 'Failed to load campaigns.'}
          </p>
          <Button variant="secondary" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--color-bg-page)', minHeight: '100vh', padding: '48px 24px' }}>
      <div style={{ maxWidth: '960px', margin: '0 auto' }}>

        {/* Page header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '40px',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          <div>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: 'var(--color-text-accent)',
                margin: '0 0 8px',
              }}
            >
              My Portfolio
            </p>
            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '40px',
                textTransform: 'uppercase',
                color: 'var(--color-text-primary)',
                margin: 0,
                lineHeight: 1,
              }}
            >
              My Campaigns
            </h1>
          </div>
          <Button
            variant="primary"
            size="md"
            onClick={() => navigate('/campaigns/new')}
          >
            + Create Campaign
          </Button>
        </div>

        {/* Campaign list or empty state */}
        {campaigns.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '80px 24px',
              background: 'var(--gradient-surface-card)',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 'var(--radius-card)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '20px',
            }}
          >
            <div
              aria-hidden="true"
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'var(--color-bg-elevated)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '28px',
              }}
            >
              🚀
            </div>
            <div>
              <p
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '24px',
                  textTransform: 'uppercase',
                  color: 'var(--color-text-primary)',
                  margin: '0 0 8px',
                }}
              >
                No campaigns yet
              </p>
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '14px',
                  color: 'var(--color-text-secondary)',
                  margin: 0,
                  maxWidth: '380px',
                }}
              >
                You haven&apos;t created any campaigns yet. Start your Mars mission proposal.
              </p>
            </div>
            <Button
              variant="primary"
              size="lg"
              onClick={() => navigate('/campaigns/new')}
            >
              Create Campaign
            </Button>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '16px',
            }}
          >
            {campaigns.map((campaign) => (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                onClick={() => navigate(`/campaigns/${campaign.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
