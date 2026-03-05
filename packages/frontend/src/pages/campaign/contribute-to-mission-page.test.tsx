import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../api/client';
import type { PublicCampaignDetail } from '../../types/campaign';
import type { Contribution } from '../../types/contribution';
import ContributeToMissionPage from './contribute-to-mission-page';

// Mock hooks
vi.mock('../../hooks/campaign/use-public-campaign', () => ({
  usePublicCampaign: vi.fn(),
  publicCampaignQueryKey: (id: string) => ['publicCampaign', id],
}));

vi.mock('../../hooks/campaign/use-contribute', () => ({
  useContribute: vi.fn(),
}));

import { useContribute } from '../../hooks/campaign/use-contribute';
import { usePublicCampaign } from '../../hooks/campaign/use-public-campaign';

const mockCampaign: PublicCampaignDetail = {
  id: '550e8400-e29b-41d4-a716-446655440001',
  title: 'Advanced Ion Drive Propulsion System',
  shortDescription: 'Next-generation ion drive for deep space missions.',
  description: 'Developing ion drive technology for Mars missions.',
  category: 'propulsion',
  heroImageUrl: null,
  status: 'live',
  fundingGoalCents: '310840000',
  totalRaisedCents: '130552800',
  fundingCapCents: null,
  contributorCount: 317,
  fundingPercentage: 42,
  deadline: '2026-06-15T00:00:00Z',
  daysRemaining: 102,
  launchedAt: '2026-01-15T00:00:00Z',
  creatorName: 'Dr. Sarah Chen',
  milestones: [],
  teamMembers: [],
  riskDisclosures: [],
  budgetBreakdown: [],
  alignmentStatement: null,
  tags: [],
};

const defaultContributeHook = {
  contribute: vi.fn(),
  isPending: false,
  contribution: null,
  error: null,
  reset: vi.fn(),
};

function renderPage(campaignId = '550e8400-e29b-41d4-a716-446655440001') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/campaigns/${campaignId}/contribute`]}>
        <Routes>
          <Route path="/campaigns/:id/contribute" element={<ContributeToMissionPage />} />
          <Route path="/campaigns/:id" element={<div>Campaign Detail</div>} />
          <Route path="/campaigns" element={<div>Browse Campaigns</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ContributeToMissionPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useContribute).mockReturnValue(defaultContributeHook);
  });

  describe('Loading state', () => {
    it('renders loading spinner while campaign data is fetching', () => {
      vi.mocked(usePublicCampaign).mockReturnValue({
        campaign: null,
        isLoading: true,
        isError: false,
        error: null,
      });
      renderPage();
      expect(screen.getByRole('status', { name: 'Loading campaign...' })).toBeInTheDocument();
    });
  });

  describe('Error state', () => {
    it('renders not found message for 404 error', () => {
      vi.mocked(usePublicCampaign).mockReturnValue({
        campaign: null,
        isLoading: false,
        isError: true,
        error: { status: 404, code: 'NOT_FOUND', message: 'Campaign not found' } as never,
      });
      renderPage();
      expect(screen.getByRole('heading', { name: /mission not found/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /browse campaigns/i })).toBeInTheDocument();
    });

    it('renders generic error message for non-404 API errors', () => {
      vi.mocked(usePublicCampaign).mockReturnValue({
        campaign: null,
        isLoading: false,
        isError: true,
        error: { status: 500, code: 'SERVER_ERROR', message: 'Server error' } as never,
      });
      renderPage();
      expect(screen.getByRole('heading', { name: /something went wrong/i })).toBeInTheDocument();
    });
  });

  describe('Unavailable state', () => {
    it('renders "not accepting contributions" when campaign is funded', () => {
      vi.mocked(usePublicCampaign).mockReturnValue({
        campaign: { ...mockCampaign, status: 'funded' },
        isLoading: false,
        isError: false,
        error: null,
      });
      renderPage();
      expect(
        screen.getByRole('heading', { name: /not accepting contributions/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/this mission is no longer accepting contributions/i),
      ).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /back to campaign/i })).toBeInTheDocument();
    });
  });

  describe('Form state (default)', () => {
    beforeEach(() => {
      vi.mocked(usePublicCampaign).mockReturnValue({
        campaign: mockCampaign,
        isLoading: false,
        isError: false,
        error: null,
      });
    });

    it('renders amount input, payment token input, and submit button', () => {
      renderPage();
      expect(screen.getByLabelText(/amount \(usd\)/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/payment token/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /back this mission/i })).toBeInTheDocument();
    });

    it('shows campaign title and funding progress for context', () => {
      renderPage();
      expect(screen.getByText('Advanced Ion Drive Propulsion System')).toBeInTheDocument();
      // Progress bar should be rendered
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('displays payment token hint text', () => {
      renderPage();
      expect(screen.getByText(/tok_fail/)).toBeInTheDocument();
      expect(screen.getByText(/test payment failure/i)).toBeInTheDocument();
    });

    it('shows back to campaign link', () => {
      renderPage();
      expect(screen.getByRole('link', { name: /back to campaign/i })).toBeInTheDocument();
    });
  });

  describe('Form validation', () => {
    beforeEach(() => {
      vi.mocked(usePublicCampaign).mockReturnValue({
        campaign: mockCampaign,
        isLoading: false,
        isError: false,
        error: null,
      });
    });

    it('submit button is disabled when amount is empty', () => {
      renderPage();
      const button = screen.getByRole('button', { name: /back this mission/i });
      expect(button).toBeDisabled();
    });

    it('submit button is disabled when amount is below minimum', async () => {
      renderPage();
      const amountInput = screen.getByLabelText(/amount \(usd\)/i);
      await userEvent.clear(amountInput);
      await userEvent.type(amountInput, '4.99');
      const button = screen.getByRole('button', { name: /back this mission/i });
      expect(button).toBeDisabled();
    });

    it('shows minimum amount error message when amount is too low', async () => {
      renderPage();
      const amountInput = screen.getByLabelText(/amount \(usd\)/i);
      await userEvent.clear(amountInput);
      await userEvent.type(amountInput, '3');
      expect(screen.getByText(/minimum contribution is \$5\.00/i)).toBeInTheDocument();
    });

    it('submit button is disabled when payment token is empty', async () => {
      renderPage();
      const amountInput = screen.getByLabelText(/amount \(usd\)/i);
      await userEvent.type(amountInput, '10');
      const button = screen.getByRole('button', { name: /back this mission/i });
      expect(button).toBeDisabled();
    });

    it('submit button is enabled when amount >= 5 and token is provided', async () => {
      renderPage();
      const amountInput = screen.getByLabelText(/amount \(usd\)/i);
      await userEvent.type(amountInput, '10');
      const tokenInput = screen.getByLabelText(/payment token/i);
      await userEvent.type(tokenInput, 'tok_test');
      const button = screen.getByRole('button', { name: /back this mission/i });
      expect(button).not.toBeDisabled();
    });

    it('shows real-time preview when amount is valid', async () => {
      renderPage();
      const amountInput = screen.getByLabelText(/amount \(usd\)/i);
      await userEvent.type(amountInput, '10');
      expect(screen.getByText(/you are contributing \$10\.00/i)).toBeInTheDocument();
    });
  });

  describe('Submitting state', () => {
    beforeEach(() => {
      vi.mocked(usePublicCampaign).mockReturnValue({
        campaign: mockCampaign,
        isLoading: false,
        isError: false,
        error: null,
      });
    });

    it('submit button shows loading state during mutation', () => {
      vi.mocked(useContribute).mockReturnValue({
        ...defaultContributeHook,
        isPending: true,
      });
      renderPage();
      expect(screen.getByText(/processing\.\.\./i)).toBeInTheDocument();
    });

    it('inputs are disabled during submission', () => {
      vi.mocked(useContribute).mockReturnValue({
        ...defaultContributeHook,
        isPending: true,
      });
      renderPage();
      expect(screen.getByLabelText(/amount \(usd\)/i)).toBeDisabled();
      expect(screen.getByLabelText(/payment token/i)).toBeDisabled();
    });

    it('calls contribute with correct input on valid form submission', async () => {
      const mockContribute = vi.fn();
      vi.mocked(useContribute).mockReturnValue({
        ...defaultContributeHook,
        contribute: mockContribute,
      });
      renderPage();

      const amountInput = screen.getByLabelText(/amount \(usd\)/i);
      await userEvent.type(amountInput, '10');
      const tokenInput = screen.getByLabelText(/payment token/i);
      await userEvent.type(tokenInput, 'tok_test_123');

      const form = screen.getByRole('button', { name: /back this mission/i }).closest('form');
      expect(form).toBeTruthy();
      await act(async () => {
        fireEvent.submit(form!);
      });

      expect(mockContribute).toHaveBeenCalledWith({
        campaignId: '550e8400-e29b-41d4-a716-446655440001',
        amountCents: '1000',
        paymentToken: 'tok_test_123',
      });
    });

    it('prevents double-submit during pending mutation', async () => {
      const mockContribute = vi.fn();
      vi.mocked(useContribute).mockReturnValue({
        ...defaultContributeHook,
        isPending: true,
        contribute: mockContribute,
      });
      renderPage();

      const button = screen.getByRole('button', { name: /processing/i });
      expect(button).toBeDisabled();
    });
  });

  describe('Success state (captured)', () => {
    const capturedContribution: Contribution = {
      id: '660e8400-e29b-41d4-a716-446655440001',
      campaignId: '550e8400-e29b-41d4-a716-446655440001',
      amountCents: '1000',
      status: 'captured',
      transactionRef: 'stub_txn_ABCDEF12',
      failureReason: null,
      createdAt: '2026-03-05T12:00:00Z',
    };

    beforeEach(() => {
      vi.mocked(usePublicCampaign).mockReturnValue({
        campaign: mockCampaign,
        isLoading: false,
        isError: false,
        error: null,
      });
      vi.mocked(useContribute).mockReturnValue({
        ...defaultContributeHook,
        contribution: capturedContribution,
      });
    });

    it('shows "Mission Backed!" confirmation heading', () => {
      renderPage();
      expect(screen.getByRole('heading', { name: /mission backed!/i })).toBeInTheDocument();
    });

    it('shows formatted contribution amount', () => {
      renderPage();
      expect(screen.getByText(/\$10\.00/)).toBeInTheDocument();
    });

    it('shows transaction reference', () => {
      renderPage();
      expect(screen.getByText('stub_txn_ABCDEF12')).toBeInTheDocument();
    });

    it('shows "Return to Mission" link pointing to /campaigns/:id', () => {
      renderPage();
      const link = screen.getByRole('link', { name: /return to mission/i });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', `/campaigns/${mockCampaign.id}`);
    });
  });

  describe('Payment failed state (failed)', () => {
    const failedContribution: Contribution = {
      id: '770e8400-e29b-41d4-a716-446655440001',
      campaignId: '550e8400-e29b-41d4-a716-446655440001',
      amountCents: '1000',
      status: 'failed',
      transactionRef: null,
      failureReason: 'Payment declined by gateway.',
      createdAt: '2026-03-05T12:00:00Z',
    };

    beforeEach(() => {
      vi.mocked(usePublicCampaign).mockReturnValue({
        campaign: mockCampaign,
        isLoading: false,
        isError: false,
        error: null,
      });
      vi.mocked(useContribute).mockReturnValue({
        ...defaultContributeHook,
        contribution: failedContribution,
      });
    });

    it('shows "Payment Not Processed" heading', () => {
      renderPage();
      expect(screen.getByRole('heading', { name: /payment not processed/i })).toBeInTheDocument();
    });

    it('shows failure reason from API response', () => {
      renderPage();
      expect(screen.getByText('Payment declined by gateway.')).toBeInTheDocument();
    });

    it('shows "Try Again" button that resets to form state', async () => {
      const mockReset = vi.fn();
      vi.mocked(useContribute).mockReturnValue({
        ...defaultContributeHook,
        contribution: failedContribution,
        reset: mockReset,
      });
      renderPage();

      const tryAgainButton = screen.getByRole('button', { name: /try again/i });
      expect(tryAgainButton).toBeInTheDocument();
      await userEvent.click(tryAgainButton);
      expect(mockReset).toHaveBeenCalled();
    });
  });

  describe('Duplicate error (409)', () => {
    beforeEach(() => {
      vi.mocked(usePublicCampaign).mockReturnValue({
        campaign: mockCampaign,
        isLoading: false,
        isError: false,
        error: null,
      });
    });

    it('shows inline duplicate error message', () => {
      const duplicateError = new ApiError(409, 'DUPLICATE_CONTRIBUTION', 'Duplicate contribution.');
      vi.mocked(useContribute).mockReturnValue({
        ...defaultContributeHook,
        error: duplicateError,
      });
      renderPage();
      expect(screen.getByRole('alert')).toHaveTextContent(
        /identical contribution was submitted within the last 60 seconds/i,
      );
    });

    it('submit button is re-enabled after duplicate error (not pending)', () => {
      const duplicateError = new ApiError(409, 'DUPLICATE_CONTRIBUTION', 'Duplicate contribution.');
      vi.mocked(useContribute).mockReturnValue({
        ...defaultContributeHook,
        error: duplicateError,
      });
      renderPage();
      // The form is still shown — not a full page error state
      expect(screen.getByLabelText(/amount \(usd\)/i)).toBeInTheDocument();
    });
  });

  describe('Network error', () => {
    beforeEach(() => {
      vi.mocked(usePublicCampaign).mockReturnValue({
        campaign: mockCampaign,
        isLoading: false,
        isError: false,
        error: null,
      });
    });

    it('shows network error message inline', () => {
      const networkError = new ApiError(0, 'NETWORK_ERROR', 'Check your connection.');
      vi.mocked(useContribute).mockReturnValue({
        ...defaultContributeHook,
        error: networkError,
      });
      renderPage();
      expect(screen.getByRole('alert')).toHaveTextContent(/network error/i);
    });
  });

  describe('Campaign funded (422)', () => {
    beforeEach(() => {
      vi.mocked(usePublicCampaign).mockReturnValue({
        campaign: mockCampaign,
        isLoading: false,
        isError: false,
        error: null,
      });
    });

    it('shows campaign funded error inline for 422 response', () => {
      const fundedError = new ApiError(
        422,
        'CAMPAIGN_NOT_ACCEPTING_CONTRIBUTIONS',
        'Campaign funded.',
      );
      vi.mocked(useContribute).mockReturnValue({
        ...defaultContributeHook,
        error: fundedError,
      });
      renderPage();
      expect(screen.getByRole('alert')).toHaveTextContent(/fully funded/i);
    });
  });
});
