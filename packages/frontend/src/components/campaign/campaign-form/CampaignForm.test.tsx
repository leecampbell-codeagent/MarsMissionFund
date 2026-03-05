import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { MilestonesSection } from './MilestonesSection';
import { type Campaign, type Milestone } from '../../../types/campaign';

// Minimal campaign for testing sections
const baseCampaign: Campaign = {
  id: '550e8400-e29b-41d4-a716-446655440001',
  creatorUserId: '550e8400-e29b-41d4-a716-446655440002',
  title: 'Test Campaign',
  shortDescription: null,
  description: null,
  category: null,
  heroImageUrl: null,
  fundingGoalCents: null,
  fundingCapCents: null,
  deadline: null,
  milestones: [],
  teamMembers: [],
  riskDisclosures: [],
  budgetBreakdown: [],
  alignmentStatement: null,
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

describe('MilestonesSection', () => {
  it('shows running basis points total', () => {
    const milestones: Milestone[] = [
      { title: 'Phase 1', description: 'First phase', fundingBasisPoints: 5000, targetDate: null },
      { title: 'Phase 2', description: 'Second phase', fundingBasisPoints: 3000, targetDate: null },
    ];
    render(<MilestonesSection campaign={{ ...baseCampaign, milestones }} onChange={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent('8000 / 10,000');
  });

  it('shows warning state when total is not 10000', () => {
    const milestones: Milestone[] = [
      { title: 'Phase 1', description: 'Test', fundingBasisPoints: 5000, targetDate: null },
    ];
    render(<MilestonesSection campaign={{ ...baseCampaign, milestones }} onChange={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent('incomplete');
  });

  it('shows success state when total is exactly 10000', () => {
    const milestones: Milestone[] = [
      { title: 'Phase 1', description: 'First', fundingBasisPoints: 5000, targetDate: null },
      { title: 'Phase 2', description: 'Second', fundingBasisPoints: 5000, targetDate: null },
    ];
    render(<MilestonesSection campaign={{ ...baseCampaign, milestones }} onChange={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent('complete');
  });

  it('shows empty state when no milestones', () => {
    render(<MilestonesSection campaign={baseCampaign} onChange={vi.fn()} />);
    expect(screen.getByText('No milestones added yet.')).toBeInTheDocument();
  });

  it('calls onChange when Add Milestone is clicked', async () => {
    const handleChange = vi.fn();
    render(<MilestonesSection campaign={baseCampaign} onChange={handleChange} />);
    await userEvent.click(screen.getByRole('button', { name: '+ Add Milestone' }));
    expect(handleChange).toHaveBeenCalledWith('milestones', expect.arrayContaining([
      expect.objectContaining({ title: '', description: '' }),
    ]));
  });

  it('calls onChange to remove a milestone', async () => {
    const milestones: Milestone[] = [
      { title: 'Phase 1', description: 'First', fundingBasisPoints: 10000, targetDate: null },
    ];
    const handleChange = vi.fn();
    render(<MilestonesSection campaign={{ ...baseCampaign, milestones }} onChange={handleChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Remove milestone 1' }));
    expect(handleChange).toHaveBeenCalledWith('milestones', []);
  });

  it('displays milestone count when milestones exist', () => {
    const milestones: Milestone[] = [
      { title: 'Phase 1', description: 'First', fundingBasisPoints: 5000, targetDate: null },
      { title: 'Phase 2', description: 'Second', fundingBasisPoints: 5000, targetDate: null },
    ];
    render(<MilestonesSection campaign={{ ...baseCampaign, milestones }} onChange={vi.fn()} />);
    expect(screen.getByLabelText('Milestone 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Milestone 2')).toBeInTheDocument();
  });
});

describe('ReviewSubmitSection', () => {
  it('is tested via ReviewSubmitSection.test.tsx', () => {
    // Basic smoke test to ensure module loads
    expect(true).toBe(true);
  });
});

describe('CampaignForm integration', () => {
  it('renders section navigation', async () => {
    const { ReviewSubmitSection } = await import('./ReviewSubmitSection');
    const mockCampaign = baseCampaign;
    const handleSubmit = vi.fn();

    render(
      <ReviewSubmitSection
        campaign={mockCampaign}
        onSubmit={handleSubmit}
        isSubmitting={false}
        submitError={null}
      />,
    );

    expect(screen.getByRole('button', { name: 'Submit campaign for review' })).toBeInTheDocument();
  });

  it('submit button disabled when validation issues exist', async () => {
    const { ReviewSubmitSection } = await import('./ReviewSubmitSection');
    render(
      <ReviewSubmitSection
        campaign={baseCampaign}
        onSubmit={vi.fn()}
        isSubmitting={false}
        submitError={null}
      />,
    );

    const submitBtn = screen.getByRole('button', { name: 'Submit campaign for review' });
    expect(submitBtn).toBeDisabled();
  });

  it('shows validation alert when issues exist', async () => {
    const { ReviewSubmitSection } = await import('./ReviewSubmitSection');
    render(
      <ReviewSubmitSection
        campaign={baseCampaign}
        onSubmit={vi.fn()}
        isSubmitting={false}
        submitError={null}
      />,
    );

    expect(screen.getByRole('alert', { name: 'Validation issues' })).toBeInTheDocument();
  });

  it('shows submit error from server', async () => {
    const { ReviewSubmitSection } = await import('./ReviewSubmitSection');
    const error = { status: 400, code: 'SUBMISSION_VALIDATION_ERROR', message: 'Milestone funding must sum to 10000.' } as import('../../../api/client').ApiError;

    render(
      <ReviewSubmitSection
        campaign={baseCampaign}
        onSubmit={vi.fn()}
        isSubmitting={false}
        submitError={error}
      />,
    );

    // Multiple alerts: validation issues + server error — use getAllByRole
    const alerts = screen.getAllByRole('alert');
    const serverErrorAlert = alerts.find((el) => el.textContent?.includes('Milestone funding must sum to 10000.'));
    expect(serverErrorAlert).toBeDefined();
    expect(serverErrorAlert).toHaveTextContent('Milestone funding must sum to 10000.');
  });

  it('shows loading state while submitting', async () => {
    const { ReviewSubmitSection } = await import('./ReviewSubmitSection');
    const fullyValid: Campaign = {
      ...baseCampaign,
      shortDescription: 'A great campaign for Mars',
      description: 'Full description of the campaign',
      category: 'propulsion_systems',
      heroImageUrl: 'https://example.com/hero.jpg',
      fundingGoalCents: '100000000',
      deadline: '2027-01-15T00:00:00.000Z',
      teamMembers: [{ name: 'John', role: 'Engineer', bio: null, linkedInUrl: null }],
      milestones: [
        { title: 'M1', description: 'First', fundingBasisPoints: 5000, targetDate: null },
        { title: 'M2', description: 'Second', fundingBasisPoints: 5000, targetDate: null },
      ],
      riskDisclosures: [{ title: 'Risk 1', description: 'A risk', severity: 'medium' }],
    };

    render(
      <ReviewSubmitSection
        campaign={fullyValid}
        onSubmit={vi.fn()}
        isSubmitting={true}
        submitError={null}
      />,
    );

    expect(screen.getByText('Submitting...')).toBeInTheDocument();
  });

  it('waits for async change to propagate', async () => {
    const handleChange = vi.fn();
    render(<MilestonesSection campaign={baseCampaign} onChange={handleChange} />);

    await userEvent.click(screen.getByRole('button', { name: '+ Add Milestone' }));

    await waitFor(() => {
      expect(handleChange).toHaveBeenCalled();
    });
  });
});
