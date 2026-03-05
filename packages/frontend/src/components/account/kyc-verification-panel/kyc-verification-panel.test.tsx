import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../api/client';
import { KycVerificationPanel } from './kyc-verification-panel';

// Mock the useKycSubmit hook so we can control its behaviour in tests
vi.mock('../../../hooks/account/use-kyc-submit', () => ({
  useKycSubmit: vi.fn(),
}));

import { useKycSubmit } from '../../../hooks/account/use-kyc-submit';

const mockSubmitKyc = vi.fn();

const defaultHookReturn = {
  submitKyc: mockSubmitKyc,
  isLoading: false,
  isError: false,
  error: null,
};

beforeEach(() => {
  vi.mocked(useKycSubmit).mockReturnValue(defaultHookReturn);
  mockSubmitKyc.mockClear();
  mockSubmitKyc.mockResolvedValue(undefined);
});

describe('KycVerificationPanel', () => {
  describe('loading state', () => {
    it('renders loading skeleton when isLoading=true', () => {
      const { container } = render(<KycVerificationPanel isLoading />);
      expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
      expect(
        container.querySelector('[aria-label="Loading identity verification status"]'),
      ).toBeInTheDocument();
    });

    it('does not render CTA button in loading state', () => {
      render(<KycVerificationPanel isLoading />);
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('renders error message when error prop is provided', () => {
      const error = new Error('Network error');
      render(<KycVerificationPanel error={error} />);
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/Failed to load verification status/i)).toBeInTheDocument();
    });

    it('renders retry button when onRetry is provided', () => {
      const error = new Error('Network error');
      const onRetry = vi.fn();
      render(<KycVerificationPanel error={error} onRetry={onRetry} />);
      expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
    });

    it('calls onRetry when retry button is clicked', async () => {
      const user = userEvent.setup();
      const error = new Error('Network error');
      const onRetry = vi.fn();
      render(<KycVerificationPanel error={error} onRetry={onRetry} />);
      await user.click(screen.getByRole('button', { name: /Retry/i }));
      expect(onRetry).toHaveBeenCalledOnce();
    });
  });

  describe('not_started state', () => {
    it('renders "Verify Your Identity" heading', () => {
      render(<KycVerificationPanel kycStatus="not_started" />);
      expect(screen.getByText('Verify Your Identity')).toBeInTheDocument();
    });

    it('renders identity verification description', () => {
      render(<KycVerificationPanel kycStatus="not_started" />);
      expect(screen.getByText(/complete identity verification/i)).toBeInTheDocument();
    });

    it('renders "Start Verification" primary CTA button', () => {
      render(<KycVerificationPanel kycStatus="not_started" />);
      expect(screen.getByRole('button', { name: /Start Verification/i })).toBeInTheDocument();
    });

    it('CTA button is enabled in not_started state', () => {
      render(<KycVerificationPanel kycStatus="not_started" />);
      expect(screen.getByRole('button', { name: /Start Verification/i })).not.toBeDisabled();
    });

    it('triggers submitKyc mutation when CTA is clicked', async () => {
      const user = userEvent.setup();
      render(<KycVerificationPanel kycStatus="not_started" />);
      await user.click(screen.getByRole('button', { name: /Start Verification/i }));
      expect(mockSubmitKyc).toHaveBeenCalledOnce();
    });

    it('does not render KycStatusBadge in not_started state', () => {
      render(<KycVerificationPanel kycStatus="not_started" />);
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
  });

  describe('pending state', () => {
    it('renders KycStatusBadge with pending status', () => {
      render(<KycVerificationPanel kycStatus="pending" />);
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText('VERIFICATION IN PROGRESS')).toBeInTheDocument();
    });

    it('renders pending description text', () => {
      render(<KycVerificationPanel kycStatus="pending" />);
      expect(screen.getByText(/verification is being processed/i)).toBeInTheDocument();
    });

    it('does not render action button in pending state', () => {
      render(<KycVerificationPanel kycStatus="pending" />);
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });

  describe('in_review state', () => {
    it('renders KycStatusBadge with in_review status', () => {
      render(<KycVerificationPanel kycStatus="in_review" />);
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText('UNDER REVIEW')).toBeInTheDocument();
    });

    it('renders in_review description text', () => {
      render(<KycVerificationPanel kycStatus="in_review" />);
      // Match the specific body text paragraph, not the badge
      expect(screen.getByText(/Your documents are under review/i)).toBeInTheDocument();
    });

    it('does not render action button in in_review state', () => {
      render(<KycVerificationPanel kycStatus="in_review" />);
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });

  describe('verified state', () => {
    it('renders KycStatusBadge with verified status', () => {
      render(<KycVerificationPanel kycStatus="verified" />);
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText('IDENTITY VERIFIED')).toBeInTheDocument();
    });

    it('renders verified description text', () => {
      render(<KycVerificationPanel kycStatus="verified" />);
      expect(screen.getByText(/eligible to submit campaigns/i)).toBeInTheDocument();
    });

    it('does not render action button in verified state', () => {
      render(<KycVerificationPanel kycStatus="verified" />);
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });

  describe('rejected state', () => {
    it('renders KycStatusBadge with rejected status', () => {
      render(<KycVerificationPanel kycStatus="rejected" />);
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText('VERIFICATION FAILED')).toBeInTheDocument();
    });

    it('renders rejected description text', () => {
      render(<KycVerificationPanel kycStatus="rejected" />);
      expect(screen.getByText(/You may resubmit/i)).toBeInTheDocument();
    });

    it('renders "Resubmit Verification" CTA button', () => {
      render(<KycVerificationPanel kycStatus="rejected" />);
      expect(screen.getByRole('button', { name: /Resubmit Verification/i })).toBeInTheDocument();
    });

    it('triggers submitKyc mutation when Resubmit CTA is clicked', async () => {
      const user = userEvent.setup();
      render(<KycVerificationPanel kycStatus="rejected" />);
      await user.click(screen.getByRole('button', { name: /Resubmit Verification/i }));
      expect(mockSubmitKyc).toHaveBeenCalledOnce();
    });
  });

  describe('expired state', () => {
    it('renders KycStatusBadge with expired status', () => {
      render(<KycVerificationPanel kycStatus="expired" />);
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText('VERIFICATION EXPIRED')).toBeInTheDocument();
    });

    it('renders expired description text', () => {
      render(<KycVerificationPanel kycStatus="expired" />);
      expect(screen.getByText(/verification has expired/i)).toBeInTheDocument();
    });

    it('does not render action button in expired state', () => {
      render(<KycVerificationPanel kycStatus="expired" />);
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });

  describe('CTA loading state (mutation in-flight)', () => {
    it('disables CTA button when isLoading=true on useKycSubmit', () => {
      vi.mocked(useKycSubmit).mockReturnValue({
        ...defaultHookReturn,
        isLoading: true,
      });
      render(<KycVerificationPanel kycStatus="not_started" />);
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('shows "Verifying…" label when mutation is in-flight', () => {
      vi.mocked(useKycSubmit).mockReturnValue({
        ...defaultHookReturn,
        isLoading: true,
      });
      render(<KycVerificationPanel kycStatus="not_started" />);
      expect(screen.getByText(/Verifying/i)).toBeInTheDocument();
    });

    it('sets aria-busy="true" on CTA button while loading', () => {
      vi.mocked(useKycSubmit).mockReturnValue({
        ...defaultHookReturn,
        isLoading: true,
      });
      render(<KycVerificationPanel kycStatus="not_started" />);
      expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
    });
  });

  describe('CTA error state (mutation failed)', () => {
    it('shows inline error message when isError=true', () => {
      const apiError = new ApiError(500, 'INTERNAL_ERROR', 'Something went wrong');
      vi.mocked(useKycSubmit).mockReturnValue({
        ...defaultHookReturn,
        isError: true,
        error: apiError,
      });
      render(<KycVerificationPanel kycStatus="not_started" />);
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/Verification could not be completed/i)).toBeInTheDocument();
    });

    it('CTA button re-enables after error (not disabled)', () => {
      const apiError = new ApiError(500, 'INTERNAL_ERROR', 'Something went wrong');
      vi.mocked(useKycSubmit).mockReturnValue({
        ...defaultHookReturn,
        isError: true,
        error: apiError,
      });
      render(<KycVerificationPanel kycStatus="not_started" />);
      expect(screen.getByRole('button', { name: /Start Verification/i })).not.toBeDisabled();
    });
  });
});
