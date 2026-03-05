import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { CampaignStatus } from '../../../types/campaign';
import { CampaignStatusBadge } from './CampaignStatusBadge';

describe('CampaignStatusBadge', () => {
  const statusCases: Array<{ status: CampaignStatus; label: string }> = [
    { status: 'draft', label: 'Draft' },
    { status: 'submitted', label: 'Submitted' },
    { status: 'under_review', label: 'Under Review' },
    { status: 'approved', label: 'Approved' },
    { status: 'rejected', label: 'Rejected' },
    { status: 'live', label: 'Live' },
    { status: 'archived', label: 'Archived' },
  ];

  it.each(statusCases)('renders correct label for status "$status"', ({ status, label }) => {
    render(<CampaignStatusBadge status={status} />);
    expect(screen.getByRole('status', { name: `Campaign status: ${label}` })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(label);
  });

  it('renders draft badge with muted styling', () => {
    render(<CampaignStatusBadge status="draft" />);
    const badge = screen.getByRole('status');
    expect(badge).toHaveStyle({ color: 'var(--color-text-tertiary)' });
  });

  it('renders archived badge with muted styling', () => {
    render(<CampaignStatusBadge status="archived" />);
    const badge = screen.getByRole('status');
    expect(badge).toHaveStyle({ color: 'var(--color-text-tertiary)' });
  });

  it('renders approved badge with success color token', () => {
    render(<CampaignStatusBadge status="approved" />);
    const badge = screen.getByRole('status');
    expect(badge).toHaveStyle({ color: 'var(--color-status-success)' });
  });

  it('renders rejected badge with error color token', () => {
    render(<CampaignStatusBadge status="rejected" />);
    const badge = screen.getByRole('status');
    expect(badge).toHaveStyle({ color: 'var(--color-status-error)' });
  });

  it('renders live badge with success color token', () => {
    render(<CampaignStatusBadge status="live" />);
    const badge = screen.getByRole('status');
    expect(badge).toHaveStyle({ color: 'var(--color-status-success)' });
  });

  it('renders submitted badge with warning color token', () => {
    render(<CampaignStatusBadge status="submitted" />);
    const badge = screen.getByRole('status');
    expect(badge).toHaveStyle({ color: 'var(--color-status-warning)' });
  });
});
