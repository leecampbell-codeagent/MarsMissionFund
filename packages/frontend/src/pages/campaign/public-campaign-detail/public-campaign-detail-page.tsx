import type { ReactElement } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FundingProgressBar } from '../../../components/campaign/funding-progress-bar/FundingProgressBar';
import { PublicStatusBadge } from '../../../components/campaign/public-status-badge/PublicStatusBadge';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { usePublicCampaign } from '../../../hooks/campaign/use-public-campaign';
import {
  CAMPAIGN_CATEGORY_LABELS,
  type CampaignCategory,
  formatBasisPoints,
  formatCents,
} from '../../../types/campaign';

function DaysRemainingText({
  daysRemaining,
}: {
  readonly daysRemaining: number | null;
}): ReactElement {
  if (daysRemaining === null) {
    return (
      <span
        style={{
          fontFamily: 'var(--font-data)',
          fontSize: '14px',
          color: 'var(--color-text-tertiary)',
        }}
      >
        No deadline
      </span>
    );
  }
  if (daysRemaining === 0) {
    return (
      <span
        style={{
          fontFamily: 'var(--font-data)',
          fontSize: '14px',
          color: 'var(--color-status-warning)',
        }}
      >
        Last day!
      </span>
    );
  }
  return (
    <span
      style={{
        fontFamily: 'var(--font-data)',
        fontSize: '14px',
        color: 'var(--color-text-secondary)',
      }}
    >
      {daysRemaining} days left
    </span>
  );
}

/**
 * PublicCampaignDetailPage — /campaigns/:id (public view)
 * Shows full public campaign detail for live and funded campaigns.
 * No authentication required.
 */
export default function PublicCampaignDetailPage(): ReactElement {
  const { id } = useParams<{ id: string }>();
  const { campaign, isLoading, isError, error } = usePublicCampaign(id ?? '');

  // Loading state
  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          background: 'var(--color-bg-page)',
        }}
      >
        <LoadingSpinner size="lg" label="Loading campaign" />
      </div>
    );
  }

  // 404 / not found
  if ((isError && error?.status === 404) || (!isLoading && !isError && !campaign)) {
    return (
      <div
        style={{
          background: 'var(--color-bg-page)',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 24px',
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: '400px' }}>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '48px',
              textTransform: 'uppercase',
              color: 'var(--color-text-primary)',
              margin: '0 0 16px',
            }}
          >
            Mission Not Found
          </h1>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '14px',
              color: 'var(--color-text-secondary)',
              margin: '0 0 24px',
            }}
          >
            This campaign doesn&apos;t exist or is no longer publicly accessible.
          </p>
          <Link
            to="/campaigns"
            style={{
              background: 'var(--gradient-action-primary)',
              borderRadius: 'var(--radius-button)',
              color: 'var(--color-action-primary-text)',
              fontFamily: 'var(--font-body)',
              fontSize: '15px',
              fontWeight: 600,
              padding: '10px 24px',
              textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            Browse Campaigns
          </Link>
        </div>
      </div>
    );
  }

  // Generic error state
  if (isError) {
    return (
      <div
        style={{
          background: 'var(--color-bg-page)',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 24px',
        }}
      >
        <div
          role="alert"
          style={{
            textAlign: 'center',
            maxWidth: '400px',
          }}
        >
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '16px',
              color: 'var(--color-status-error)',
              margin: '0 0 16px',
            }}
          >
            Unable to load this campaign. Please try again.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              background: 'var(--color-bg-elevated)',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 'var(--radius-button)',
              color: 'var(--color-text-primary)',
              fontFamily: 'var(--font-body)',
              fontSize: '14px',
              padding: '8px 20px',
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!campaign) return <></>;

  const categoryLabel =
    campaign.category && campaign.category in CAMPAIGN_CATEGORY_LABELS
      ? CAMPAIGN_CATEGORY_LABELS[campaign.category as CampaignCategory]
      : campaign.category;

  const creatorDisplay = campaign.creatorName ?? 'Creator';

  return (
    <div style={{ background: 'var(--color-bg-page)', minHeight: '100vh', padding: '0 0 64px' }}>
      {/* Hero section */}
      <div
        style={{
          height: '360px',
          overflow: 'hidden',
          background: campaign.heroImageUrl ? undefined : 'var(--gradient-surface-card)',
          position: 'relative',
        }}
      >
        {campaign.heroImageUrl ? (
          <img
            src={campaign.heroImageUrl}
            alt={`Hero image for ${campaign.title}`}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div
            aria-hidden="true"
            style={{
              width: '100%',
              height: '100%',
              background: 'var(--gradient-campaign-hero)',
              opacity: 0.5,
            }}
          />
        )}
      </div>

      {/* Page content */}
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '0 24px' }}>
        {/* Campaign header */}
        <div style={{ marginTop: '-40px', position: 'relative', zIndex: 1, marginBottom: '32px' }}>
          <div
            style={{
              background: 'var(--gradient-surface-card)',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 'var(--radius-card-large)',
              padding: '32px',
            }}
          >
            {/* Badges row */}
            <div
              style={{
                display: 'flex',
                gap: '10px',
                alignItems: 'center',
                flexWrap: 'wrap',
                marginBottom: '16px',
              }}
            >
              <PublicStatusBadge status={campaign.status} daysRemaining={campaign.daysRemaining} />
              {categoryLabel && (
                <span
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '12px',
                    color: 'var(--color-text-accent)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  {categoryLabel}
                </span>
              )}
            </div>

            {/* Title */}
            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '48px',
                textTransform: 'uppercase',
                color: 'var(--color-text-primary)',
                margin: '0 0 8px',
                lineHeight: 1.05,
              }}
            >
              {campaign.title}
            </h1>

            {/* Creator */}
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '14px',
                color: 'var(--color-text-tertiary)',
                margin: '0 0 24px',
              }}
            >
              by {creatorDisplay}
            </p>

            {/* Funding progress */}
            <FundingProgressBar
              fundingPercentage={campaign.fundingPercentage}
              totalRaisedCents={campaign.totalRaisedCents}
              fundingGoalCents={campaign.fundingGoalCents}
              contributorCount={campaign.contributorCount}
            />

            {/* Days remaining */}
            <div style={{ marginTop: '12px' }}>
              <DaysRemainingText daysRemaining={campaign.daysRemaining} />
            </div>

            {/* Primary CTA — one per viewport */}
            <div style={{ marginTop: '24px' }}>
              <Link
                to={`/campaigns/${campaign.id}/contribute`}
                aria-label="Back this mission"
                style={{
                  display: 'inline-block',
                  background: 'var(--gradient-action-primary)',
                  borderRadius: 'var(--radius-button)',
                  color: 'var(--color-action-primary-text)',
                  fontFamily: 'var(--font-body)',
                  fontSize: '16px',
                  fontWeight: 700,
                  padding: '14px 32px',
                  textDecoration: 'none',
                  boxShadow: '0 4px 20px var(--color-action-primary-shadow)',
                }}
              >
                Back This Mission
              </Link>
            </div>
          </div>
        </div>

        {/* Two-column content layout */}
        <div style={{ display: 'flex', gap: '32px', alignItems: 'flex-start' }}>
          {/* Main content */}
          <div
            style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '40px' }}
          >
            {/* Description */}
            {campaign.description && (
              <section aria-label="Campaign description">
                <h2
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '28px',
                    textTransform: 'uppercase',
                    color: 'var(--color-text-primary)',
                    margin: '0 0 16px',
                  }}
                >
                  About This Mission
                </h2>
                <div
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '15px',
                    color: 'var(--color-text-secondary)',
                    lineHeight: 1.7,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {campaign.description}
                </div>
              </section>
            )}

            {/* Team */}
            <section aria-label="Team members">
              <h2
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '28px',
                  textTransform: 'uppercase',
                  color: 'var(--color-text-primary)',
                  margin: '0 0 16px',
                }}
              >
                Team
              </h2>
              {campaign.teamMembers.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {campaign.teamMembers.map((member) => (
                    <div
                      key={member.id}
                      style={{
                        background: 'var(--color-bg-elevated)',
                        border: '1px solid var(--color-border-subtle)',
                        borderRadius: 'var(--radius-card)',
                        padding: '16px',
                      }}
                    >
                      <div
                        style={{
                          fontFamily: 'var(--font-body)',
                          fontSize: '14px',
                          fontWeight: 700,
                          color: 'var(--color-text-primary)',
                          marginBottom: '4px',
                        }}
                      >
                        {member.name}
                      </div>
                      <div
                        style={{
                          fontFamily: 'var(--font-body)',
                          fontSize: '13px',
                          color: 'var(--color-text-accent)',
                          marginBottom: member.bio ? '8px' : 0,
                        }}
                      >
                        {member.role}
                      </div>
                      {member.bio && (
                        <p
                          style={{
                            fontFamily: 'var(--font-body)',
                            fontSize: '13px',
                            color: 'var(--color-text-secondary)',
                            margin: 0,
                            lineHeight: 1.5,
                          }}
                        >
                          {member.bio}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '14px',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  Team information unavailable.
                </p>
              )}
            </section>

            {/* Risks */}
            {campaign.riskDisclosures.length > 0 && (
              <section aria-label="Risk disclosures">
                <h2
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '28px',
                    textTransform: 'uppercase',
                    color: 'var(--color-text-primary)',
                    margin: '0 0 16px',
                  }}
                >
                  Risks
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {campaign.riskDisclosures.map((risk) => (
                    <div
                      key={risk.id}
                      style={{
                        background: 'var(--color-bg-elevated)',
                        border: '1px solid var(--color-border-subtle)',
                        borderRadius: 'var(--radius-card)',
                        padding: '16px',
                      }}
                    >
                      <p
                        style={{
                          fontFamily: 'var(--font-body)',
                          fontSize: '14px',
                          color: 'var(--color-text-secondary)',
                          margin: '0 0 8px',
                        }}
                      >
                        {risk.risk}
                      </p>
                      <p
                        style={{
                          fontFamily: 'var(--font-body)',
                          fontSize: '13px',
                          color: 'var(--color-text-tertiary)',
                          margin: 0,
                        }}
                      >
                        <strong>Mitigation:</strong> {risk.mitigation}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Alignment statement */}
            {campaign.alignmentStatement && (
              <section aria-label="Mars mission alignment">
                <h2
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '28px',
                    textTransform: 'uppercase',
                    color: 'var(--color-text-primary)',
                    margin: '0 0 12px',
                  }}
                >
                  Mars Mission Alignment
                </h2>
                <p
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '15px',
                    color: 'var(--color-text-secondary)',
                    lineHeight: 1.6,
                    margin: 0,
                  }}
                >
                  {campaign.alignmentStatement}
                </p>
              </section>
            )}

            {/* Tags */}
            {campaign.tags.length > 0 && (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {campaign.tags.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: '12px',
                      padding: '4px 12px',
                      borderRadius: 'var(--radius-badge)',
                      border: '1px solid var(--color-border-input)',
                      background: 'var(--color-bg-input)',
                      color: 'var(--color-text-secondary)',
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div
            style={{
              width: '300px',
              flexShrink: 0,
              position: 'sticky',
              top: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
            }}
          >
            {/* Milestones */}
            <div
              style={{
                background: 'var(--color-bg-elevated)',
                border: '1px solid var(--color-border-subtle)',
                borderRadius: 'var(--radius-card)',
                padding: '20px',
              }}
            >
              <h3
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '20px',
                  textTransform: 'uppercase',
                  color: 'var(--color-text-primary)',
                  margin: '0 0 16px',
                }}
              >
                Milestones
              </h3>
              {campaign.milestones.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {campaign.milestones.map((milestone) => (
                    <div
                      key={milestone.id}
                      style={{
                        borderLeft: '2px solid var(--color-action-primary)',
                        paddingLeft: '12px',
                      }}
                    >
                      <div
                        style={{
                          fontFamily: 'var(--font-body)',
                          fontSize: '13px',
                          fontWeight: 600,
                          color: 'var(--color-text-primary)',
                          marginBottom: '4px',
                        }}
                      >
                        {milestone.title}
                      </div>
                      <div
                        style={{
                          fontFamily: 'var(--font-data)',
                          fontSize: '12px',
                          color: 'var(--color-text-accent)',
                          marginBottom: milestone.description ? '4px' : 0,
                        }}
                      >
                        {formatBasisPoints(milestone.fundingBasisPoints)}
                      </div>
                      {milestone.description && (
                        <p
                          style={{
                            fontFamily: 'var(--font-body)',
                            fontSize: '12px',
                            color: 'var(--color-text-secondary)',
                            margin: 0,
                            lineHeight: 1.4,
                          }}
                        >
                          {milestone.description}
                        </p>
                      )}
                      {milestone.targetDate && (
                        <p
                          style={{
                            fontFamily: 'var(--font-data)',
                            fontSize: '11px',
                            color: 'var(--color-text-tertiary)',
                            margin: '4px 0 0',
                          }}
                        >
                          Target: {milestone.targetDate}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '13px',
                    color: 'var(--color-text-secondary)',
                    margin: 0,
                  }}
                >
                  No milestones defined.
                </p>
              )}
            </div>

            {/* Budget breakdown */}
            {campaign.budgetBreakdown.length > 0 && (
              <div
                style={{
                  background: 'var(--color-bg-elevated)',
                  border: '1px solid var(--color-border-subtle)',
                  borderRadius: 'var(--radius-card)',
                  padding: '20px',
                }}
              >
                <h3
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '20px',
                    textTransform: 'uppercase',
                    color: 'var(--color-text-primary)',
                    margin: '0 0 16px',
                  }}
                >
                  Budget
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {campaign.budgetBreakdown.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      <span
                        style={{
                          fontFamily: 'var(--font-body)',
                          fontSize: '13px',
                          color: 'var(--color-text-secondary)',
                        }}
                      >
                        {item.category}
                      </span>
                      <span
                        style={{
                          fontFamily: 'var(--font-data)',
                          fontSize: '13px',
                          color: 'var(--color-text-primary)',
                          fontWeight: 600,
                        }}
                      >
                        {formatCents(item.estimatedCents)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
