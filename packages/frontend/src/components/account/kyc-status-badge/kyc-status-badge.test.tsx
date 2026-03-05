import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { KycStatusBadge } from './kyc-status-badge';

describe('KycStatusBadge', () => {
  it('renders "IDENTITY VERIFICATION REQUIRED" for not_started', () => {
    render(<KycStatusBadge kycStatus="not_started" />);
    expect(screen.getByText('IDENTITY VERIFICATION REQUIRED')).toBeInTheDocument();
  });

  it('renders "VERIFICATION IN PROGRESS" for pending', () => {
    render(<KycStatusBadge kycStatus="pending" />);
    expect(screen.getByText('VERIFICATION IN PROGRESS')).toBeInTheDocument();
  });

  it('renders "UNDER REVIEW" for in_review', () => {
    render(<KycStatusBadge kycStatus="in_review" />);
    expect(screen.getByText('UNDER REVIEW')).toBeInTheDocument();
  });

  it('renders "IDENTITY VERIFIED" for verified', () => {
    render(<KycStatusBadge kycStatus="verified" />);
    expect(screen.getByText('IDENTITY VERIFIED')).toBeInTheDocument();
  });

  it('renders "VERIFICATION FAILED" for rejected', () => {
    render(<KycStatusBadge kycStatus="rejected" />);
    expect(screen.getByText('VERIFICATION FAILED')).toBeInTheDocument();
  });

  it('renders "VERIFICATION EXPIRED" for expired', () => {
    render(<KycStatusBadge kycStatus="expired" />);
    expect(screen.getByText('VERIFICATION EXPIRED')).toBeInTheDocument();
  });

  it('has role="status" for screen reader announcements', () => {
    render(<KycStatusBadge kycStatus="verified" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('badge text is visible (not just aria-label)', () => {
    render(<KycStatusBadge kycStatus="verified" />);
    const badge = screen.getByRole('status');
    expect(badge).toHaveTextContent('IDENTITY VERIFIED');
  });

  it('dot indicator is aria-hidden (decorative)', () => {
    const { container } = render(<KycStatusBadge kycStatus="verified" />);
    const dot = container.querySelector('[aria-hidden="true"]');
    expect(dot).toBeInTheDocument();
  });
});
