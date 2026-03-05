import { useAuth } from '@clerk/clerk-react';
import { type ReactElement, useState } from 'react';
import type { DocumentType } from '../api/kyc-api';
import { KycStatusBadge } from '../components/kyc/KycStatusBadge';
import { useKycStatus } from '../hooks/kyc/use-kyc-status';
import { useSubmitKyc } from '../hooks/kyc/use-submit-kyc';

const DOCUMENT_TYPE_LABELS: Readonly<Record<DocumentType, string>> = {
  passport: 'Passport',
  national_id: 'National ID',
  drivers_licence: "Driver's Licence",
};

const STATUS_DESCRIPTIONS: Readonly<Record<string, string>> = {
  not_verified:
    'Your identity has not been verified. Complete verification to unlock Creator features.',
  pending:
    'Your documents are being reviewed. This typically takes a few minutes.',
  pending_resubmission:
    'Your documents could not be verified. Please resubmit with clearer images.',
  in_manual_review:
    'Your submission is in manual review. Our team will contact you within 1-2 business days.',
  verified: 'Your identity has been verified. Creator features are unlocked.',
  rejected:
    'Your verification has been rejected. Please contact support for assistance.',
  locked:
    'Your account is locked due to too many failed verification attempts. Contact support or an administrator to unlock.',
  expired: 'Your verification has expired. Please resubmit your documents.',
  reverification_required:
    'Re-verification is required. Please submit your documents again.',
};

function canSubmit(status: string): boolean {
  return (
    status === 'not_verified' ||
    status === 'pending_resubmission' ||
    status === 'expired' ||
    status === 'reverification_required'
  );
}

export default function VerificationSettingsPage(): ReactElement {
  const { isLoaded } = useAuth();
  const { data: kycStatus, isLoading } = useKycStatus();
  const submitKyc = useSubmitKyc();

  const [documentType, setDocumentType] = useState<DocumentType>('passport');
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setSubmitError(null);
    try {
      await submitKyc.mutateAsync({ document_type: documentType });
    } catch {
      setSubmitError('Verification submission failed. Please try again.');
    }
  }

  if (isLoading || !isLoaded) {
    return (
      <div className="settings-page">
        <div className="settings-page__content">
          <div className="skeleton skeleton--label" />
          <div className="skeleton skeleton--heading" />
          <div className="skeleton skeleton--badge" />
          <div className="skeleton skeleton--text" />
        </div>
        <style>{`
          .settings-page {
            display: flex;
            justify-content: center;
            flex: 1;
            padding: 24px 0;
          }
          .settings-page__content { max-width: 600px; width: 100%; }
          .skeleton {
            background: var(--color-bg-input);
            border-radius: var(--radius-input);
            animation: skel-pulse 1.5s ease-in-out infinite alternate;
          }
          .skeleton--label { height: 16px; width: 120px; margin-bottom: 16px; }
          .skeleton--heading { height: 48px; width: 280px; margin-bottom: 32px; }
          .skeleton--badge { height: 28px; width: 140px; margin-bottom: 24px; }
          .skeleton--text { height: 60px; width: 100%; margin-bottom: 24px; }
          @keyframes skel-pulse {
            from { opacity: 0.5; }
            to { opacity: 1; }
          }
          @media (prefers-reduced-motion: reduce) {
            .skeleton { animation: none; opacity: 0.7; }
          }
        `}</style>
      </div>
    );
  }

  const currentStatus = kycStatus?.status ?? 'not_verified';
  const showForm = canSubmit(currentStatus);
  const isPending = currentStatus === 'pending';

  return (
    <>
      <div className="settings-page">
        <div className="settings-page__content">
          <p className="settings-page__section-label">02 — VERIFICATION</p>
          <h1 className="settings-page__heading">IDENTITY VERIFICATION</h1>

          <div className="kyc-status-row">
            <KycStatusBadge status={currentStatus} />
            {isPending && (
              <span className="kyc-polling-indicator" aria-live="polite">
                <span className="kyc-spinner" aria-hidden="true" />
                Checking status...
              </span>
            )}
          </div>

          <p className="kyc-description">
            {STATUS_DESCRIPTIONS[currentStatus] ?? 'Unknown status.'}
          </p>

          {kycStatus?.verifiedAt && (
            <p className="kyc-meta">
              Verified:{' '}
              {new Intl.DateTimeFormat(undefined, {
                dateStyle: 'medium',
                timeStyle: 'short',
              }).format(new Date(kycStatus.verifiedAt))}
            </p>
          )}

          {kycStatus && kycStatus.failureCount > 0 && currentStatus !== 'verified' && (
            <p className="kyc-meta kyc-meta--warning">
              Failed attempts: {kycStatus.failureCount} / 5
            </p>
          )}

          {showForm && (
            <form
              className="kyc-form"
              onSubmit={(e) => {
                void handleSubmit(e);
              }}
              noValidate
            >
              <h2 className="kyc-form__heading">
                {currentStatus === 'not_verified' ? 'Submit Verification' : 'Resubmit Documents'}
              </h2>

              {submitError && (
                <div className="kyc-form__error" role="alert">
                  {submitError}
                </div>
              )}

              <div className="form-field">
                <label htmlFor="kyc-document-type" className="form-label">
                  DOCUMENT TYPE
                </label>
                <select
                  id="kyc-document-type"
                  className="form-input"
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value as DocumentType)}
                >
                  {(Object.entries(DOCUMENT_TYPE_LABELS) as [DocumentType, string][]).map(
                    ([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ),
                  )}
                </select>
                <p className="form-helper">
                  Select the type of identity document you wish to submit.
                </p>
              </div>

              <div className="settings-page__button-row">
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={submitKyc.isPending}
                  aria-busy={submitKyc.isPending}
                >
                  {submitKyc.isPending ? (
                    <>
                      <span className="btn-spinner" aria-hidden="true" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    'Submit for Verification'
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
      <style>{`
        .settings-page {
          display: flex;
          justify-content: center;
          flex: 1;
          padding: 24px 0;
        }

        @media (min-width: 768px) {
          .settings-page { padding: 32px 0; }
        }

        @media (min-width: 1024px) {
          .settings-page { padding: 48px 0; }
        }

        .settings-page__content {
          max-width: 600px;
          width: 100%;
        }

        .settings-page__section-label {
          font-family: var(--font-data);
          font-size: 11px;
          font-weight: 400;
          letter-spacing: 0.3em;
          text-transform: uppercase;
          color: var(--color-text-accent);
          margin-bottom: 16px;
        }

        .settings-page__heading {
          font-family: var(--font-display);
          font-size: 40px;
          font-weight: 400;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--color-text-primary);
          line-height: 1;
          margin-bottom: 24px;
        }

        @media (min-width: 640px) {
          .settings-page__heading { font-size: 56px; }
        }

        .kyc-status-row {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 16px;
        }

        .kyc-polling-indicator {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-family: var(--font-data);
          font-size: 11px;
          color: var(--color-text-tertiary);
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .kyc-spinner {
          width: 12px;
          height: 12px;
          border: 2px solid rgba(255, 255, 255, 0.15);
          border-top-color: var(--color-text-accent);
          border-radius: 50%;
          animation: kyc-spin 800ms linear infinite;
          flex-shrink: 0;
        }

        @keyframes kyc-spin {
          to { transform: rotate(360deg); }
        }

        @media (prefers-reduced-motion: reduce) {
          .kyc-spinner { animation: none; opacity: 0.5; }
        }

        .kyc-description {
          font-family: var(--font-body);
          font-size: 15px;
          color: var(--color-text-secondary);
          line-height: 1.6;
          margin-bottom: 24px;
        }

        .kyc-meta {
          font-family: var(--font-data);
          font-size: 12px;
          color: var(--color-text-tertiary);
          margin-bottom: 8px;
          letter-spacing: 0.03em;
        }

        .kyc-meta--warning {
          color: var(--color-text-warning);
        }

        .kyc-form {
          margin-top: 32px;
          padding-top: 32px;
          border-top: 1px solid var(--color-border-subtle);
        }

        .kyc-form__heading {
          font-family: var(--font-display);
          font-size: 24px;
          font-weight: 400;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--color-text-primary);
          margin-bottom: 24px;
        }

        .kyc-form__error {
          background: rgba(193, 68, 14, 0.1);
          border: 1px solid var(--color-status-error);
          border-radius: var(--radius-input);
          padding: 12px 16px;
          font-family: var(--font-body);
          font-size: 13px;
          color: var(--color-text-error);
          margin-bottom: 24px;
        }

        .form-field {
          margin-bottom: 24px;
        }

        .form-label {
          display: block;
          font-family: var(--font-data);
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: var(--color-text-tertiary);
          margin-bottom: 8px;
        }

        .form-input {
          width: 100%;
          background: var(--color-bg-input);
          border: 1px solid var(--color-border-input);
          border-radius: var(--radius-input);
          padding: 14px 16px;
          font-family: var(--font-body);
          font-size: 16px;
          font-weight: 400;
          color: var(--color-text-primary);
          box-sizing: border-box;
          transition:
            border-color var(--motion-hover-duration) var(--motion-hover-easing),
            box-shadow var(--motion-hover-duration) var(--motion-hover-easing);
          appearance: none;
        }

        .form-input:focus {
          outline: none;
          border-color: var(--color-border-emphasis);
          box-shadow: 0 0 0 3px rgba(255, 92, 26, 0.25);
        }

        .form-helper {
          font-family: var(--font-body);
          font-size: 13px;
          color: var(--color-text-tertiary);
          margin-top: 4px;
        }

        .settings-page__button-row {
          display: flex;
          justify-content: flex-end;
          margin-top: 32px;
        }

        .btn-primary {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: var(--gradient-action-primary);
          color: var(--color-action-primary-text);
          border: none;
          border-radius: var(--radius-button);
          font-family: var(--font-body);
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 0.01em;
          padding: 12px 32px;
          cursor: pointer;
          box-shadow: 0 4px 16px var(--color-action-primary-shadow);
          transition: opacity var(--motion-hover-duration) var(--motion-hover-easing);
        }

        .btn-primary:hover:not(:disabled) {
          opacity: 0.9;
        }

        .btn-primary:focus-visible {
          outline: 2px solid var(--color-action-primary-hover);
          outline-offset: 2px;
        }

        .btn-primary:disabled {
          background: var(--gradient-action-primary);
          opacity: 0.4;
          cursor: not-allowed;
          box-shadow: none;
        }

        .btn-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(245, 248, 255, 0.3);
          border-top-color: var(--color-action-primary-text);
          border-radius: 50%;
          animation: btn-spin 800ms linear infinite;
          flex-shrink: 0;
        }

        @keyframes btn-spin {
          to { transform: rotate(360deg); }
        }

        @media (prefers-reduced-motion: reduce) {
          .btn-spinner { animation: none; opacity: 0.5; }
        }
      `}</style>
    </>
  );
}
