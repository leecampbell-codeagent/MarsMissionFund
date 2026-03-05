import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CampaignStatusBadge } from './CampaignStatusBadge';

describe('CampaignStatusBadge', () => {
  it('renders DRAFT label for draft status', () => {
    render(<CampaignStatusBadge status="draft" />);
    expect(screen.getByLabelText(/status: draft/i)).toBeInTheDocument();
    expect(screen.getByText('DRAFT')).toBeInTheDocument();
  });

  it('renders SUBMITTED label for submitted status', () => {
    render(<CampaignStatusBadge status="submitted" />);
    expect(screen.getByText('SUBMITTED')).toBeInTheDocument();
  });

  it('renders LIVE label for live status', () => {
    render(<CampaignStatusBadge status="live" />);
    expect(screen.getByText('LIVE')).toBeInTheDocument();
  });

  it('renders FUNDED label for funded status', () => {
    render(<CampaignStatusBadge status="funded" />);
    expect(screen.getByText('FUNDED')).toBeInTheDocument();
  });

  it('renders REJECTED label for rejected status', () => {
    render(<CampaignStatusBadge status="rejected" />);
    expect(screen.getByText('REJECTED')).toBeInTheDocument();
  });

  it('renders unknown status in uppercase', () => {
    render(<CampaignStatusBadge status="some_unknown" />);
    expect(screen.getByText('SOME_UNKNOWN')).toBeInTheDocument();
  });
});
