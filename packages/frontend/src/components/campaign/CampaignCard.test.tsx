import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { CampaignCard } from './CampaignCard';
import type { CampaignResponse } from '../../api/campaign-api';

function makeCampaign(overrides: Partial<CampaignResponse> = {}): CampaignResponse {
  return {
    id: 'camp-001',
    creator_id: 'user-001',
    title: 'Ion Drive Project',
    summary: 'A revolutionary propulsion system.',
    description: null,
    mars_alignment_statement: null,
    category: 'propulsion',
    status: 'draft',
    min_funding_target_cents: '150000000',
    max_funding_cap_cents: '500000000',
    deadline: null,
    budget_breakdown: null,
    team_info: null,
    risk_disclosures: null,
    hero_image_url: null,
    milestones: [],
    created_at: '2026-03-01T00:00:00Z',
    updated_at: '2026-03-01T00:00:00Z',
    ...overrides,
  };
}

function renderCard(campaign: CampaignResponse) {
  return render(
    <MemoryRouter>
      <CampaignCard campaign={campaign} />
    </MemoryRouter>,
  );
}

describe('CampaignCard', () => {
  it('renders campaign title', () => {
    renderCard(makeCampaign());
    expect(screen.getByText('Ion Drive Project')).toBeInTheDocument();
  });

  it('renders campaign summary', () => {
    renderCard(makeCampaign());
    expect(screen.getByText('A revolutionary propulsion system.')).toBeInTheDocument();
  });

  it('formats min funding target as USD currency', () => {
    renderCard(makeCampaign({ min_funding_target_cents: '150000000' }));
    // $1,500,000 or similar
    expect(screen.getByText(/\$1,500,000/)).toBeInTheDocument();
  });

  it('shows EDIT DRAFT link for draft campaigns', () => {
    renderCard(makeCampaign({ status: 'draft' }));
    const editLink = screen.getByRole('link', { name: /edit draft/i });
    expect(editLink).toBeInTheDocument();
    expect(editLink).toHaveAttribute('href', '/campaigns/camp-001/edit');
  });

  it('shows VIEW link for submitted campaigns', () => {
    renderCard(makeCampaign({ status: 'submitted' }));
    expect(screen.getByRole('link', { name: /view/i })).toBeInTheDocument();
  });

  it('renders category label', () => {
    renderCard(makeCampaign({ category: 'propulsion' }));
    expect(screen.getByText('PROPULSION')).toBeInTheDocument();
  });

  it('renders deadline when set', () => {
    renderCard(makeCampaign({ deadline: '2026-09-01T00:00:00Z' }));
    expect(screen.getByText(/DEADLINE/)).toBeInTheDocument();
  });

  it('does not render deadline when not set', () => {
    renderCard(makeCampaign({ deadline: null }));
    expect(screen.queryByText(/DEADLINE/)).not.toBeInTheDocument();
  });
});
