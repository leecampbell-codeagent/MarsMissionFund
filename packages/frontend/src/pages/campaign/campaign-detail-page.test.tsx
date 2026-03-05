import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CampaignDetailPage from './campaign-detail-page';
import { type Campaign } from '../../types/campaign';
import { ApiError } from '../../api/client';

// Mock hooks
vi.mock('../../hooks/campaign/use-campaign', () => ({
  useCampaign: vi.fn(),
}));
vi.mock('../../hooks/campaign/use-campaign-actions', () => ({
  useCampaignActions: vi.fn(),
}));
vi.mock('../../hooks/account/use-current-user', () => ({
  useCurrentUser: vi.fn(),
}));

import { useCampaign } from '../../hooks/campaign/use-campaign';
import { useCampaignActions } from '../../hooks/campaign/use-campaign-actions';
import { useCurrentUser } from '../../hooks/account/use-current-user';

const mockCampaign: Campaign = {
  id: '550e8400-e29b-41d4-a716-446655440001',
  creatorUserId: '550e8400-e29b-41d4-a716-446655440002',
  title: 'Ion Drive Propulsion System',
  shortDescription: 'An advanced ion drive for interplanetary travel.',
  description: 'Full description of the ion drive system.',
  category: 'propulsion',
  heroImageUrl: null,
  fundingGoalCents: '150000000',
  fundingCapCents: '200000000',
  deadline: '2027-01-15T00:00:00.000Z',
  milestones: [
    { title: 'Design Phase', description: 'Complete engineering design', fundingBasisPoints: 3000, targetDate: null },
    { title: 'Prototype', description: 'Build working prototype', fundingBasisPoints: 7000, targetDate: null },
  ],
  teamMembers: [{ id: '550e8400-e29b-41d4-a716-446655440003', name: 'Alice', role: 'Chief Engineer', bio: null, linkedInUrl: null }],
  riskDisclosures: [{ id: '550e8400-e29b-41d4-a716-446655440099', risk: 'Tech Risk', mitigation: 'Mitigation plan in place' }],
  budgetBreakdown: [],
  alignmentStatement: 'Advances Mars propulsion capability.',
  tags: [],
  status: 'draft',
  rejectionReason: null,
  resubmissionGuidance: null,
  reviewNotes: null,
  reviewedByUserId: null,
  reviewedAt: null,
  submittedAt: null,
  launchedAt: null,
  createdAt: '2026-01-15T10:00:00Z',
  updatedAt: '2026-01-15T10:00:00Z',
};

const mockActions = {
  claim: { mutate: vi.fn(), isLoading: false, isError: false, error: null },
  approve: { mutate: vi.fn(), isLoading: false, isError: false, error: null },
  reject: { mutate: vi.fn(), isLoading: false, isError: false, error: null },
  launch: { mutate: vi.fn(), isLoading: false, isError: false, error: null },
  archive: { mutate: vi.fn(), isLoading: false, isError: false, error: null },
  reassign: { mutate: vi.fn(), isLoading: false, isError: false, error: null },
};

function renderDetailPage(campaignId = '550e8400-e29b-41d4-a716-446655440001') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/campaigns/${campaignId}`]}>
        <Routes>
          <Route path="/campaigns/:id" element={<CampaignDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('CampaignDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useCampaignActions).mockReturnValue(mockActions);
    vi.mocked(useCurrentUser).mockReturnValue({
      user: {
        id: '550e8400-e29b-41d4-a716-446655440002', // creator
        clerkUserId: 'user_test',
        email: 'creator@test.com',
        displayName: 'Creator',
        bio: null,
        avatarUrl: null,
        accountStatus: 'active',
        roles: ['creator', 'backer'],
        kycStatus: 'verified',
        onboardingCompleted: true,
        onboardingStep: null,
        notificationPrefs: {
          campaignUpdates: true,
          milestoneCompletions: true,
          contributionConfirmations: true,
          recommendations: false,
          securityAlerts: true,
          platformAnnouncements: false,
        },
        lastSeenAt: null,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
      isLoading: false,
      isError: false,
      error: null,
    });
  });

  it('shows loading state', () => {
    vi.mocked(useCampaign).mockReturnValue({ campaign: null, isLoading: true, isError: false, error: null });
    renderDetailPage();
    expect(screen.getByRole('status', { name: 'Loading campaign' })).toBeInTheDocument();
  });

  it('shows "Campaign not found" on 404 error without leaking access reason', () => {
    vi.mocked(useCampaign).mockReturnValue({
      campaign: null,
      isLoading: false,
      isError: true,
      error: new ApiError(404, 'CAMPAIGN_NOT_FOUND', 'Not found'),
    });
    renderDetailPage();
    expect(screen.getByRole('heading', { name: 'Campaign Not Found' })).toBeInTheDocument();
    // Should not say "access denied" or "permission" — EC-033
    expect(screen.queryByText(/access denied/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/permission/i)).not.toBeInTheDocument();
  });

  it('renders campaign title and status badge', () => {
    vi.mocked(useCampaign).mockReturnValue({ campaign: mockCampaign, isLoading: false, isError: false, error: null });
    renderDetailPage();
    expect(screen.getByRole('heading', { name: 'Ion Drive Propulsion System', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Campaign status: Draft' })).toBeInTheDocument();
  });

  it('displays rejectionReason when status is rejected and viewer is creator', () => {
    const rejectedCampaign: Campaign = {
      ...mockCampaign,
      status: 'rejected',
      rejectionReason: 'Technical specs are insufficient.',
      resubmissionGuidance: 'Add detailed engineering specs.',
      reviewedAt: '2026-02-01T10:00:00Z',
    };
    vi.mocked(useCampaign).mockReturnValue({ campaign: rejectedCampaign, isLoading: false, isError: false, error: null });
    renderDetailPage();
    expect(screen.getByRole('region', { name: 'Rejection feedback' })).toBeInTheDocument();
    expect(screen.getByText('Technical specs are insufficient.')).toBeInTheDocument();
  });

  it('does not show rejection panel when viewer is not creator', () => {
    const rejectedCampaign: Campaign = {
      ...mockCampaign,
      status: 'rejected',
      rejectionReason: 'Not good enough.',
      resubmissionGuidance: 'Improve it.',
      reviewedAt: '2026-02-01T10:00:00Z',
    };
    vi.mocked(useCampaign).mockReturnValue({ campaign: rejectedCampaign, isLoading: false, isError: false, error: null });
    // Different user (not creator)
    vi.mocked(useCurrentUser).mockReturnValue({
      user: {
        id: '550e8400-e29b-41d4-a716-446655440999',
        clerkUserId: 'user_reviewer',
        email: 'reviewer@test.com',
        displayName: 'Reviewer',
        bio: null,
        avatarUrl: null,
        accountStatus: 'active',
        roles: ['reviewer'],
        kycStatus: 'verified',
        onboardingCompleted: true,
        onboardingStep: null,
        notificationPrefs: { campaignUpdates: true, milestoneCompletions: true, contributionConfirmations: true, recommendations: false, securityAlerts: true, platformAnnouncements: false },
        lastSeenAt: null,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
      isLoading: false,
      isError: false,
      error: null,
    });
    renderDetailPage();
    expect(screen.queryByRole('region', { name: 'Rejection feedback' })).not.toBeInTheDocument();
  });
});
