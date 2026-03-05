import { type ReactElement } from 'react';
import { type Campaign, formatCents, formatBasisPoints } from '../../../types/campaign';
import { Button } from '../../ui/Button';
import { type ApiError } from '../../../api/client';

interface ReviewSubmitSectionProps {
  readonly campaign: Campaign;
  readonly onSubmit: () => void;
  readonly isSubmitting: boolean;
  readonly submitError: ApiError | null;
}

interface ValidationIssue {
  readonly field: string;
  readonly message: string;
}

function validateForSubmit(campaign: Campaign): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!campaign.title.trim()) {
    issues.push({ field: 'Title', message: 'Title is required.' });
  }
  if (!campaign.shortDescription?.trim()) {
    issues.push({ field: 'Short Description', message: 'Short description is required.' });
  }
  if (!campaign.description?.trim()) {
    issues.push({ field: 'Description', message: 'Full description is required.' });
  }
  if (!campaign.category) {
    issues.push({ field: 'Category', message: 'Category is required.' });
  }
  if (!campaign.fundingGoalCents) {
    issues.push({ field: 'Funding Goal', message: 'Funding goal is required.' });
  }
  if (!campaign.deadline) {
    issues.push({ field: 'Deadline', message: 'Funding deadline is required.' });
  }
  if (!campaign.heroImageUrl) {
    issues.push({ field: 'Hero Image', message: 'Hero image URL is required for submission.' });
  }
  if (campaign.teamMembers.length === 0) {
    issues.push({ field: 'Team Members', message: 'At least 1 team member is required.' });
  }
  if (campaign.milestones.length < 2) {
    issues.push({ field: 'Milestones', message: 'At least 2 milestones are required.' });
  } else {
    const total = campaign.milestones.reduce((s, m) => s + m.fundingBasisPoints, 0);
    if (total !== 10000) {
      issues.push({ field: 'Milestones', message: `Funding basis points must sum to 10,000. Current: ${total}.` });
    }
  }
  if (campaign.riskDisclosures.length === 0) {
    issues.push({ field: 'Risk Disclosures', message: 'At least 1 risk disclosure is required.' });
  }

  return issues;
}

/**
 * ReviewSubmitSection — Summary of all sections with validation; submit button.
 */
export function ReviewSubmitSection({
  campaign,
  onSubmit,
  isSubmitting,
  submitError,
}: ReviewSubmitSectionProps): ReactElement {
  const issues = validateForSubmit(campaign);
  const canSubmit = issues.length === 0;

  return (
    <section aria-label="Review and Submit" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <h2
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '24px',
          color: 'var(--color-text-primary)',
          textTransform: 'uppercase',
          margin: 0,
        }}
      >
        Review &amp; Submit
      </h2>

      {/* Campaign summary */}
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
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', textTransform: 'uppercase', color: 'var(--color-text-primary)', margin: 0 }}>
          {campaign.title}
        </h3>
        {campaign.shortDescription && (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--color-text-secondary)', margin: 0 }}>
            {campaign.shortDescription}
          </p>
        )}
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          {campaign.fundingGoalCents && (
            <span style={{ fontFamily: 'var(--font-data)', fontSize: '13px', color: 'var(--color-text-primary)' }}>
              Goal: {formatCents(campaign.fundingGoalCents)}
            </span>
          )}
          {campaign.milestones.length > 0 && (
            <span style={{ fontFamily: 'var(--font-data)', fontSize: '13px', color: 'var(--color-text-primary)' }}>
              Milestones: {campaign.milestones.length}
            </span>
          )}
          {campaign.teamMembers.length > 0 && (
            <span style={{ fontFamily: 'var(--font-data)', fontSize: '13px', color: 'var(--color-text-primary)' }}>
              Team: {campaign.teamMembers.length} members
            </span>
          )}
        </div>
        {campaign.milestones.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {campaign.milestones.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-data)', fontSize: '12px', color: 'var(--color-text-tertiary)' }}>
                <span>{m.title || `Milestone ${i + 1}`}</span>
                <span>{formatBasisPoints(m.fundingBasisPoints)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Validation issues */}
      {issues.length > 0 && (
        <div
          role="alert"
          aria-label="Validation issues"
          style={{
            background: 'color-mix(in srgb, var(--color-status-warning) 10%, transparent)',
            border: '1px solid color-mix(in srgb, var(--color-status-warning) 30%, transparent)',
            borderRadius: 'var(--radius-card)',
            padding: '16px',
          }}
        >
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: 600, color: 'var(--color-status-warning)', margin: '0 0 8px' }}>
            Please resolve the following before submitting:
          </p>
          <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {issues.map((issue, i) => (
              <li key={i} style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                <strong>{issue.field}:</strong> {issue.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Server-side submit error */}
      {submitError && (
        <div
          role="alert"
          style={{
            background: 'color-mix(in srgb, var(--color-status-error) 10%, transparent)',
            border: '1px solid color-mix(in srgb, var(--color-status-error) 30%, transparent)',
            borderRadius: 'var(--radius-card)',
            padding: '16px',
          }}
        >
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-status-error)', margin: 0 }}>
            {submitError.message}
          </p>
        </div>
      )}

      {/* Submit button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="primary"
          size="lg"
          type="submit"
          onClick={onSubmit}
          disabled={!canSubmit || isSubmitting}
          isLoading={isSubmitting}
          aria-label="Submit campaign for review"
        >
          {isSubmitting ? 'Submitting...' : 'Submit for Review'}
        </Button>
      </div>

      {canSubmit && (
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-tertiary)', textAlign: 'center' }}>
          Once submitted, your campaign cannot be edited until reviewed.
        </p>
      )}
    </section>
  );
}
