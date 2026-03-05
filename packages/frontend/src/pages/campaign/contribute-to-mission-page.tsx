import { type ChangeEvent, type FormEvent, type ReactElement, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { FundingProgressBar } from '../../components/campaign/funding-progress-bar/FundingProgressBar';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { useContribute } from '../../hooks/campaign/use-contribute';
import { usePublicCampaign } from '../../hooks/campaign/use-public-campaign';
import { formatContributionAmount } from '../../types/contribution';

const MIN_AMOUNT_CENTS = 500;

function formatDollarsPreview(amountDollars: string): string {
  const value = parseFloat(amountDollars);
  if (Number.isNaN(value) || value <= 0) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

function dollarsToCentsString(amountDollars: string): string {
  const value = parseFloat(amountDollars);
  if (Number.isNaN(value)) return '0';
  return Math.round(value * 100).toString();
}

function isAmountValid(amountDollars: string): boolean {
  const value = parseFloat(amountDollars);
  if (Number.isNaN(value)) return false;
  return Math.round(value * 100) >= MIN_AMOUNT_CENTS;
}

/**
 * ContributeToMissionPage — /campaigns/:id/contribute
 *
 * Protected: must be signed in.
 * Fetches the public campaign detail to display campaign context.
 * Renders a contribution form with amount + payment token inputs.
 *
 * States: loading, unavailable, form, submitting, success, payment_failed, error
 */
export default function ContributeToMissionPage(): ReactElement {
  const { id: campaignId } = useParams<{ id: string }>();
  const { campaign, isLoading, isError, error } = usePublicCampaign(campaignId ?? '');
  const {
    contribute,
    isPending,
    contribution,
    error: mutationError,
    reset,
  } = useContribute(campaignId);

  const [amountDollars, setAmountDollars] = useState('');
  const [paymentToken, setPaymentToken] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // --- Loading state ---
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
        <LoadingSpinner size="lg" label="Loading campaign..." />
      </div>
    );
  }

  // --- Error / not found state ---
  if (isError || (!isLoading && !campaign)) {
    const is404 = (error as ApiError | null)?.status === 404;
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
            {is404 ? 'Mission Not Found' : 'Something Went Wrong'}
          </h1>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '14px',
              color: 'var(--color-text-secondary)',
              margin: '0 0 24px',
            }}
          >
            {is404
              ? "This campaign doesn't exist or is no longer publicly accessible."
              : 'Unable to load this campaign. Please try again.'}
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

  if (!campaign) return <></>;

  // --- Unavailable state — campaign is not live ---
  if (campaign.status !== 'live') {
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
        <div style={{ textAlign: 'center', maxWidth: '480px' }}>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '40px',
              textTransform: 'uppercase',
              color: 'var(--color-text-primary)',
              margin: '0 0 12px',
            }}
          >
            Not Accepting Contributions
          </h1>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '15px',
              color: 'var(--color-text-secondary)',
              margin: '0 0 8px',
            }}
          >
            This mission is no longer accepting contributions.
          </p>
          <p
            style={{
              fontFamily: 'var(--font-data)',
              fontSize: '13px',
              color: 'var(--color-text-tertiary)',
              margin: '0 0 24px',
              textTransform: 'uppercase',
            }}
          >
            Status: {campaign.status}
          </p>
          <Link
            to={`/campaigns/${campaign.id}`}
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '14px',
              color: 'var(--color-action-primary)',
              textDecoration: 'none',
            }}
          >
            ← Back to campaign
          </Link>
        </div>
      </div>
    );
  }

  // --- Success state ---
  if (contribution && contribution.status === 'captured') {
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
          style={{
            background: 'var(--gradient-surface-card)',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 'var(--radius-card)',
            padding: '40px 32px',
            maxWidth: '540px',
            width: '100%',
            textAlign: 'center',
          }}
        >
          {/* Green checkmark */}
          <div
            aria-hidden="true"
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'var(--color-status-success)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px',
              fontSize: '32px',
              color: '#fff',
            }}
          >
            ✓
          </div>

          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '48px',
              textTransform: 'uppercase',
              color: 'var(--color-status-success)',
              margin: '0 0 16px',
            }}
          >
            Mission Backed!
          </h1>

          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '16px',
              color: 'var(--color-text-secondary)',
              margin: '0 0 24px',
            }}
          >
            Your contribution of{' '}
            <strong style={{ color: 'var(--color-text-primary)' }}>
              {formatContributionAmount(contribution.amountCents)}
            </strong>{' '}
            has been confirmed.
          </p>

          {contribution.transactionRef && (
            <div
              style={{
                background: 'var(--color-bg-page)',
                border: '1px solid var(--color-border-subtle)',
                borderRadius: 'var(--radius-card)',
                padding: '16px',
                marginBottom: '24px',
              }}
            >
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '12px',
                  color: 'var(--color-text-tertiary)',
                  margin: '0 0 6px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                Transaction Reference
              </p>
              <p
                style={{
                  fontFamily: 'var(--font-data)',
                  fontSize: '14px',
                  color: 'var(--color-text-primary)',
                  margin: 0,
                  wordBreak: 'break-all',
                }}
              >
                {contribution.transactionRef}
              </p>
            </div>
          )}

          <Link
            to={`/campaigns/${campaign.id}`}
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
            Return to Mission
          </Link>
        </div>
      </div>
    );
  }

  // --- Payment failed state (API returned 201 with status: 'failed') ---
  if (contribution && contribution.status === 'failed') {
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
          style={{
            background: 'var(--gradient-surface-card)',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 'var(--radius-card)',
            padding: '40px 32px',
            maxWidth: '540px',
            width: '100%',
            textAlign: 'center',
          }}
        >
          <div
            aria-hidden="true"
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'var(--color-status-error)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px',
              fontSize: '32px',
              color: '#fff',
            }}
          >
            ✕
          </div>

          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '40px',
              textTransform: 'uppercase',
              color: 'var(--color-status-error)',
              margin: '0 0 16px',
            }}
          >
            Payment Not Processed
          </h1>

          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '15px',
              color: 'var(--color-text-secondary)',
              margin: '0 0 24px',
            }}
          >
            {contribution.failureReason ?? 'Payment could not be processed. Please try again.'}
          </p>

          <button
            type="button"
            onClick={() => {
              reset();
            }}
            style={{
              display: 'inline-block',
              background: 'var(--gradient-action-primary)',
              borderRadius: 'var(--radius-button)',
              color: 'var(--color-action-primary-text)',
              fontFamily: 'var(--font-body)',
              fontSize: '16px',
              fontWeight: 700,
              padding: '14px 32px',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 4px 20px var(--color-action-primary-shadow)',
            }}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Determine inline error for form (duplicate or other API errors)
  const duplicateError =
    mutationError instanceof ApiError && mutationError.status === 409
      ? 'An identical contribution was submitted within the last 60 seconds. Please wait before trying again.'
      : null;

  const campaignFundedError =
    mutationError instanceof ApiError && mutationError.status === 422
      ? 'Campaign has been fully funded and is no longer accepting contributions.'
      : null;

  const networkError =
    mutationError instanceof ApiError && mutationError.status === 0
      ? 'Network error. Check your connection and try again.'
      : null;

  const genericApiError =
    mutationError && !duplicateError && !campaignFundedError && !networkError
      ? mutationError instanceof ApiError
        ? mutationError.message
        : 'An unexpected error occurred.'
      : null;

  const inlineFormError =
    formError ?? duplicateError ?? campaignFundedError ?? networkError ?? genericApiError;

  const amountCentsValue = dollarsToCentsString(amountDollars);
  const amountIsValid = isAmountValid(amountDollars);
  const tokenIsValid = paymentToken.trim().length > 0 && paymentToken.length <= 500;
  const canSubmit = amountIsValid && tokenIsValid && !isPending;

  function handleSubmit(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    setFormError(null);

    if (!amountIsValid) {
      setFormError('Minimum contribution is $5.00.');
      return;
    }
    if (!tokenIsValid) {
      setFormError('Payment token is required.');
      return;
    }
    if (!campaignId) return;

    contribute({
      campaignId,
      amountCents: amountCentsValue,
      paymentToken,
    });
  }

  // --- Form state (default / submitting) ---
  return (
    <div
      style={{
        background: 'var(--color-bg-page)',
        minHeight: '100vh',
        padding: '48px 24px 64px',
      }}
    >
      <div style={{ maxWidth: '540px', margin: '0 auto' }}>
        {/* Back link */}
        <Link
          to={`/campaigns/${campaign.id}`}
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '14px',
            color: 'var(--color-text-tertiary)',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            marginBottom: '24px',
          }}
        >
          ← Back to campaign
        </Link>

        {/* Campaign summary header */}
        <div
          style={{
            background: 'var(--gradient-surface-card)',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 'var(--radius-card)',
            padding: '24px',
            marginBottom: '24px',
          }}
        >
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '28px',
              textTransform: 'uppercase',
              color: 'var(--color-text-primary)',
              margin: '0 0 16px',
              lineHeight: 1.1,
            }}
          >
            {campaign.title}
          </h2>
          <FundingProgressBar
            fundingPercentage={campaign.fundingPercentage}
            totalRaisedCents={campaign.totalRaisedCents}
            fundingGoalCents={campaign.fundingGoalCents}
            contributorCount={campaign.contributorCount}
          />
        </div>

        {/* Page heading */}
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '40px',
            textTransform: 'uppercase',
            color: 'var(--color-text-primary)',
            margin: '0 0 24px',
          }}
        >
          Back This Mission
        </h1>

        {/* Contribution form card */}
        <div
          style={{
            background: 'var(--gradient-surface-card)',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 'var(--radius-card)',
            padding: '32px',
            marginBottom: '24px',
          }}
        >
          <form onSubmit={handleSubmit} noValidate>
            {/* Amount field */}
            <div style={{ marginBottom: '24px' }}>
              <label
                htmlFor="amount"
                style={{
                  display: 'block',
                  fontFamily: 'var(--font-data)',
                  fontSize: '12px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--color-text-tertiary)',
                  marginBottom: '8px',
                }}
              >
                Amount (USD)
              </label>
              <div style={{ position: 'relative' }}>
                <span
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    left: '14px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontFamily: 'var(--font-data)',
                    fontSize: '24px',
                    color: 'var(--color-text-tertiary)',
                    pointerEvents: 'none',
                  }}
                >
                  $
                </span>
                <input
                  id="amount"
                  type="number"
                  min="5"
                  step="0.01"
                  placeholder="0.00"
                  value={amountDollars}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    setAmountDollars(e.target.value);
                    setFormError(null);
                  }}
                  disabled={isPending}
                  aria-describedby="amount-hint"
                  style={{
                    width: '100%',
                    paddingLeft: '36px',
                    paddingRight: '16px',
                    paddingTop: '14px',
                    paddingBottom: '14px',
                    background: 'var(--color-bg-input)',
                    border: '1px solid var(--color-border-input)',
                    borderRadius: 'var(--radius-input)',
                    fontFamily: 'var(--font-data)',
                    fontSize: '32px',
                    color: 'var(--color-text-primary)',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <p
                id="amount-hint"
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '12px',
                  color: 'var(--color-text-tertiary)',
                  margin: '6px 0 0',
                }}
              >
                $5.00 minimum
              </p>

              {/* Real-time preview */}
              {amountDollars && (
                <p
                  aria-live="polite"
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '14px',
                    color: amountIsValid
                      ? 'var(--color-status-success)'
                      : 'var(--color-status-error)',
                    margin: '6px 0 0',
                  }}
                >
                  {amountIsValid
                    ? `You are contributing ${formatDollarsPreview(amountDollars)}`
                    : 'Minimum contribution is $5.00'}
                </p>
              )}
            </div>

            {/* Payment token field */}
            <div style={{ marginBottom: '28px' }}>
              <label
                htmlFor="payment-token"
                style={{
                  display: 'block',
                  fontFamily: 'var(--font-data)',
                  fontSize: '12px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--color-text-tertiary)',
                  marginBottom: '8px',
                }}
              >
                Payment Token
              </label>
              <input
                id="payment-token"
                type="text"
                placeholder="tok_..."
                value={paymentToken}
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  setPaymentToken(e.target.value);
                  setFormError(null);
                }}
                disabled={isPending}
                maxLength={500}
                aria-describedby="token-hint"
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  background: 'var(--color-bg-input)',
                  border: '1px solid var(--color-border-input)',
                  borderRadius: 'var(--radius-input)',
                  fontFamily: 'var(--font-body)',
                  fontSize: '15px',
                  color: 'var(--color-text-primary)',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <p
                id="token-hint"
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '12px',
                  color: 'var(--color-text-tertiary)',
                  margin: '6px 0 0',
                }}
              >
                Use &apos;tok_fail&apos; to test payment failure.
              </p>
            </div>

            {/* Inline form error */}
            {inlineFormError && (
              <div
                role="alert"
                style={{
                  background: 'rgba(var(--color-status-error-rgb, 255 59 59) / 0.1)',
                  border: '1px solid var(--color-status-error)',
                  borderRadius: 'var(--radius-card)',
                  padding: '12px 16px',
                  marginBottom: '20px',
                  fontFamily: 'var(--font-body)',
                  fontSize: '14px',
                  color: 'var(--color-status-error)',
                }}
              >
                {inlineFormError}
              </div>
            )}

            {/* Submit button — primary CTA */}
            <button
              type="submit"
              disabled={!canSubmit}
              aria-disabled={!canSubmit}
              style={{
                width: '100%',
                padding: '16px 24px',
                background: canSubmit
                  ? 'var(--gradient-action-primary)'
                  : 'var(--color-bg-elevated)',
                borderRadius: 'var(--radius-button)',
                border: 'none',
                color: canSubmit
                  ? 'var(--color-action-primary-text)'
                  : 'var(--color-text-tertiary)',
                fontFamily: 'var(--font-body)',
                fontSize: '16px',
                fontWeight: 700,
                cursor: canSubmit ? 'pointer' : 'not-allowed',
                boxShadow: canSubmit ? '0 4px 20px var(--color-action-primary-shadow)' : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                transition: 'opacity 0.2s',
              }}
            >
              {isPending ? (
                <>
                  <LoadingSpinner size="sm" label="Processing..." color="secondary" decorative />
                  Processing...
                </>
              ) : (
                'Back This Mission →'
              )}
            </button>
          </form>
        </div>

        {/* Trust signals */}
        <div
          style={{
            display: 'flex',
            gap: '16px',
            justifyContent: 'center',
            flexWrap: 'wrap',
            marginBottom: '16px',
          }}
        >
          {['Encrypted', 'No stored card details', 'Sandbox demo'].map((badge) => (
            <span
              key={badge}
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '12px',
                color: 'var(--color-text-tertiary)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span aria-hidden="true">•</span>
              {badge}
            </span>
          ))}
        </div>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '12px',
            color: 'var(--color-text-tertiary)',
            textAlign: 'center',
            margin: 0,
          }}
        >
          Your contribution is held in secure escrow until milestones are verified.
        </p>
      </div>
    </div>
  );
}
