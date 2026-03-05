import { type ReactElement, useState, type ChangeEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCampaign } from '../../hooks/campaign/use-campaign';
import { useCampaignActions } from '../../hooks/campaign/use-campaign-actions';
import { useCurrentUser } from '../../hooks/account/use-current-user';
import { CampaignStatusBadge } from '../../components/campaign/campaign-status-badge/CampaignStatusBadge';
import { MilestoneList } from '../../components/campaign/milestone-list/MilestoneList';
import { ReviewActionPanel } from '../../components/campaign/review-action-panel/ReviewActionPanel';
import { RejectionFeedbackPanel } from '../../components/campaign/rejection-feedback-panel/RejectionFeedbackPanel';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Button } from '../../components/ui/Button';
import { CAMPAIGN_CATEGORY_LABELS, formatCents } from '../../types/campaign';

/**
 * CampaignDetailPage — /campaigns/:id
 * Shows full campaign details with role-conditional actions.
 */
export default function CampaignDetailPage(): ReactElement {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const { campaign, isLoading, isError } = useCampaign(id ?? '');
  const actions = useCampaignActions(id ?? '');

  const [reassignUserId, setReassignUserId] = useState('');
  const [showReassignForm, setShowReassignForm] = useState(false);

  const isCreator = campaign?.creatorUserId === user?.id;
  const isReviewer = user?.roles.includes('reviewer') ?? false;
  const isAdmin = user?.roles.includes('administrator') ?? false;
  const isAssignedReviewer = campaign?.reviewedByUserId === user?.id;

  // Loading
  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--color-bg-page)' }}>
        <LoadingSpinner size="lg" label="Loading campaign" />
      </div>
    );
  }

  // Error / not found — do not reveal access-denied vs not-found (EC-033)
  if (isError || !campaign) {
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
            Campaign Not Found
          </h1>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--color-text-secondary)', margin: '0 0 24px' }}>
            This campaign doesn&apos;t exist or you don&apos;t have access to view it.
          </p>
          <Button variant="secondary" onClick={() => navigate('/me/campaigns')}>
            My Campaigns
          </Button>
        </div>
      </div>
    );
  }

  const categoryLabel = campaign.category ? CAMPAIGN_CATEGORY_LABELS[campaign.category] : null;

  const formatDate = (isoString: string) =>
    new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).format(
      new Date(isoString),
    );

  const canCreatorArchive =
    campaign.status === 'draft' || campaign.status === 'rejected';
  const canCreatorEdit = campaign.status === 'draft' || campaign.status === 'rejected';
  const canCreatorLaunch = campaign.status === 'approved';

  return (
    <div style={{ background: 'var(--color-bg-page)', minHeight: '100vh', padding: '0 24px 48px' }}>
      <div style={{ maxWidth: '960px', margin: '0 auto' }}>

        {/* Hero band */}
        <div
          style={{
            height: '240px',
            borderRadius: '0 0 var(--radius-card-large) var(--radius-card-large)',
            background: campaign.heroImageUrl ? undefined : 'var(--gradient-surface-card)',
            overflow: 'hidden',
            marginBottom: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {campaign.heroImageUrl && (
            <img
              src={campaign.heroImageUrl}
              alt={`Hero image for ${campaign.title}`}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          )}
        </div>

        {/* Campaign header */}
        <div style={{ marginBottom: '40px' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap' }}>
            <CampaignStatusBadge status={campaign.status} />
            {categoryLabel && (
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '12px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--color-text-accent)',
                }}
              >
                {categoryLabel}
              </span>
            )}
          </div>

          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '48px',
              textTransform: 'uppercase',
              color: 'var(--color-text-primary)',
              margin: '0 0 12px',
              lineHeight: 1.1,
            }}
          >
            {campaign.title}
          </h1>

          {campaign.shortDescription && (
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '16px',
                color: 'var(--color-text-secondary)',
                margin: '0 0 16px',
                lineHeight: 1.6,
              }}
            >
              {campaign.shortDescription}
            </p>
          )}

          <div
            style={{
              fontFamily: 'var(--font-data)',
              fontSize: '12px',
              color: 'var(--color-text-tertiary)',
              display: 'flex',
              gap: '16px',
              flexWrap: 'wrap',
            }}
          >
            <span>Created {formatDate(campaign.createdAt)}</span>
            <span>Updated {formatDate(campaign.updatedAt)}</span>
            {campaign.submittedAt && <span>Submitted {formatDate(campaign.submittedAt)}</span>}
          </div>
        </div>

        {/* Two-column layout */}
        <div style={{ display: 'flex', gap: '32px', alignItems: 'flex-start' }}>
          {/* Left column */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {/* Description */}
            {campaign.description && (
              <section aria-label="Campaign description">
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', textTransform: 'uppercase', color: 'var(--color-text-primary)', margin: '0 0 16px' }}>
                  About This Mission
                </h2>
                {/* Rendered as plain text with white-space: pre-wrap (G-028, EC-040) */}
                <div
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '14px',
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

            {/* Team members */}
            {campaign.teamMembers.length > 0 && (
              <section aria-label="Team members">
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', textTransform: 'uppercase', color: 'var(--color-text-primary)', margin: '0 0 16px' }}>
                  Team
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {campaign.teamMembers.map((member, i) => (
                    <div
                      key={i}
                      style={{
                        background: 'var(--color-bg-elevated)',
                        border: '1px solid var(--color-border-subtle)',
                        borderRadius: 'var(--radius-card)',
                        padding: '16px',
                      }}
                    >
                      <div style={{ fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '4px' }}>
                        {member.name}
                      </div>
                      <div style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-accent)', marginBottom: '8px' }}>
                        {member.role}
                      </div>
                      {member.bio && (
                        <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.5 }}>
                          {member.bio}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Risk disclosures */}
            {campaign.riskDisclosures.length > 0 && (
              <section aria-label="Risk disclosures">
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', textTransform: 'uppercase', color: 'var(--color-text-primary)', margin: '0 0 16px' }}>
                  Risks
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {campaign.riskDisclosures.map((risk, i) => (
                    <div key={i} style={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-card)', padding: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                          {risk.title}
                        </span>
                        <span
                          style={{
                            fontFamily: 'var(--font-data)',
                            fontSize: '11px',
                            color: risk.severity === 'high' ? 'var(--color-status-error)' : risk.severity === 'medium' ? 'var(--color-status-warning)' : 'var(--color-text-tertiary)',
                            textTransform: 'uppercase',
                          }}
                        >
                          {risk.severity}
                        </span>
                      </div>
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.5 }}>
                        {risk.description}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Budget */}
            {campaign.budgetBreakdown.length > 0 && (
              <section aria-label="Budget breakdown">
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', textTransform: 'uppercase', color: 'var(--color-text-primary)', margin: '0 0 16px' }}>
                  Budget Breakdown
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {campaign.budgetBreakdown.map((item, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--color-bg-elevated)', borderRadius: 'var(--radius-input)', border: '1px solid var(--color-border-subtle)' }}>
                      <div>
                        <span style={{ fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>{item.category}</span>
                        <span style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-secondary)', marginLeft: '8px' }}>{item.description}</span>
                      </div>
                      <span style={{ fontFamily: 'var(--font-data)', fontSize: '13px', color: 'var(--color-text-primary)', fontWeight: 600 }}>
                        {formatCents(item.amountCents)}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Alignment statement */}
            {campaign.alignmentStatement && (
              <section aria-label="Mars mission alignment">
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', textTransform: 'uppercase', color: 'var(--color-text-primary)', margin: '0 0 12px' }}>
                  Mars Mission Alignment
                </h2>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.6 }}>
                  {campaign.alignmentStatement}
                </p>
              </section>
            )}
          </div>

          {/* Right column: sidebar */}
          <div
            style={{
              width: '320px',
              flexShrink: 0,
              position: 'sticky',
              top: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
            }}
          >
            {/* Funding info */}
            <div
              style={{
                background: 'var(--gradient-surface-card)',
                border: '1px solid var(--color-border-subtle)',
                borderRadius: 'var(--radius-card)',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              {campaign.fundingGoalCents && (
                <div>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-tertiary)', margin: '0 0 4px' }}>
                    Funding Goal
                  </p>
                  <p style={{ fontFamily: 'var(--font-data)', fontSize: '20px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
                    {formatCents(campaign.fundingGoalCents)}
                  </p>
                </div>
              )}
              {campaign.fundingCapCents && (
                <div>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-tertiary)', margin: '0 0 4px' }}>
                    Funding Cap
                  </p>
                  <p style={{ fontFamily: 'var(--font-data)', fontSize: '16px', color: 'var(--color-text-primary)', margin: 0 }}>
                    {formatCents(campaign.fundingCapCents)}
                  </p>
                </div>
              )}
              {campaign.deadline && (
                <div>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-tertiary)', margin: '0 0 4px' }}>
                    Deadline
                  </p>
                  <p style={{ fontFamily: 'var(--font-data)', fontSize: '14px', color: 'var(--color-text-primary)', margin: 0 }}>
                    {formatDate(campaign.deadline)}
                  </p>
                </div>
              )}
            </div>

            {/* Milestones */}
            {campaign.milestones.length > 0 && (
              <div>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', textTransform: 'uppercase', color: 'var(--color-text-primary)', margin: '0 0 12px' }}>
                  Milestones
                </h3>
                <MilestoneList milestones={campaign.milestones} />
              </div>
            )}

            {/* Creator actions */}
            {isCreator && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {canCreatorEdit && (
                  <Button variant="primary" size="md" onClick={() => navigate(`/campaigns/${campaign.id}/edit`)}>
                    Edit Campaign
                  </Button>
                )}
                {canCreatorLaunch && (
                  <Button
                    variant="primary"
                    size="md"
                    onClick={() => actions.launch.mutate()}
                    isLoading={actions.launch.isLoading}
                    disabled={actions.launch.isLoading}
                    aria-label="Launch campaign"
                  >
                    Launch Campaign
                  </Button>
                )}
                {(canCreatorArchive || isAdmin) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => actions.archive.mutate()}
                    isLoading={actions.archive.isLoading}
                    disabled={actions.archive.isLoading}
                    aria-label="Archive campaign"
                  >
                    Archive Campaign
                  </Button>
                )}
              </div>
            )}

            {/* Reviewer actions */}
            {(isReviewer || isAdmin) && !isCreator && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {campaign.status === 'submitted' && (
                  <Button
                    variant="primary"
                    size="md"
                    onClick={() => actions.claim.mutate()}
                    isLoading={actions.claim.isLoading}
                    disabled={actions.claim.isLoading}
                    aria-label="Claim campaign for review"
                  >
                    Claim for Review
                  </Button>
                )}

                {campaign.status === 'under_review' && (
                  <>
                    {campaign.reviewedByUserId && !isAssignedReviewer && !isAdmin && (
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>
                        Claimed by reviewer {campaign.reviewedByUserId.substring(0, 8)}...
                      </p>
                    )}
                    {(isAssignedReviewer || isAdmin) && (
                      <ReviewActionPanel
                        campaignId={campaign.id}
                        onApprove={(notes) => actions.approve.mutate({ reviewNotes: notes })}
                        onReject={(reason, guidance) =>
                          actions.reject.mutate({ rejectionReason: reason, resubmissionGuidance: guidance })
                        }
                        isLoading={actions.approve.isLoading || actions.reject.isLoading}
                      />
                    )}
                  </>
                )}

                {/* Admin: reassign reviewer */}
                {isAdmin && campaign.status === 'under_review' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {!showReassignForm ? (
                      <Button variant="secondary" size="sm" onClick={() => setShowReassignForm(true)}>
                        Reassign Reviewer
                      </Button>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label htmlFor="reassign-user-id" style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                          New Reviewer User ID
                        </label>
                        <input
                          id="reassign-user-id"
                          type="text"
                          value={reassignUserId}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => setReassignUserId(e.target.value)}
                          placeholder="Reviewer UUID"
                          style={{ width: '100%', background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-input)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-body)', fontSize: '13px', padding: '8px 12px', boxSizing: 'border-box' }}
                        />
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              if (reassignUserId.trim()) {
                                actions.reassign.mutate({ reviewerUserId: reassignUserId.trim() });
                                setShowReassignForm(false);
                                setReassignUserId('');
                              }
                            }}
                            disabled={!reassignUserId.trim() || actions.reassign.isLoading}
                            isLoading={actions.reassign.isLoading}
                          >
                            Confirm Reassign
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => { setShowReassignForm(false); setReassignUserId(''); }}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Admin archive */}
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => actions.archive.mutate()}
                    isLoading={actions.archive.isLoading}
                    disabled={actions.archive.isLoading}
                    aria-label="Archive campaign"
                  >
                    Archive Campaign
                  </Button>
                )}
              </div>
            )}

            {/* Action errors */}
            {(actions.claim.error || actions.approve.error || actions.reject.error || actions.launch.error || actions.archive.error) && (
              <div
                role="alert"
                style={{ background: 'color-mix(in srgb, var(--color-status-error) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--color-status-error) 30%, transparent)', borderRadius: 'var(--radius-card)', padding: '12px' }}
              >
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-status-error)', margin: 0 }}>
                  {(actions.claim.error ?? actions.approve.error ?? actions.reject.error ?? actions.launch.error ?? actions.archive.error)?.message}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Rejection feedback panel (shown to creator when rejected) */}
        {campaign.status === 'rejected' && isCreator && campaign.rejectionReason && campaign.resubmissionGuidance && (
          <div style={{ marginTop: '40px' }}>
            <RejectionFeedbackPanel
              rejectionReason={campaign.rejectionReason}
              resubmissionGuidance={campaign.resubmissionGuidance}
              reviewedAt={campaign.reviewedAt}
            />
          </div>
        )}

        {/* Reviewer notes (shown to reviewer/admin when approved/rejected) */}
        {campaign.reviewNotes && (isReviewer || isAdmin) && !isCreator && (
          <div
            style={{
              marginTop: '40px',
              background: 'var(--color-bg-elevated)',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 'var(--radius-card)',
              padding: '20px',
            }}
          >
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', textTransform: 'uppercase', color: 'var(--color-text-primary)', margin: '0 0 12px' }}>
              Review Notes
            </h3>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.6 }}>
              {campaign.reviewNotes}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
