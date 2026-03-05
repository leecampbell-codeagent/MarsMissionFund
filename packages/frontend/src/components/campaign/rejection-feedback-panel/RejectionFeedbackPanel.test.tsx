import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { RejectionFeedbackPanel } from './RejectionFeedbackPanel';

describe('RejectionFeedbackPanel', () => {
  const defaultProps = {
    rejectionReason: 'The technical specifications are insufficient.',
    resubmissionGuidance: 'Please add detailed engineering diagrams and material specifications.',
    reviewedAt: '2026-03-01T14:00:00Z',
  };

  it('renders rejection reason', () => {
    render(<RejectionFeedbackPanel {...defaultProps} />);
    expect(screen.getByText('The technical specifications are insufficient.')).toBeInTheDocument();
  });

  it('renders resubmission guidance', () => {
    render(<RejectionFeedbackPanel {...defaultProps} />);
    expect(screen.getByText('Please add detailed engineering diagrams and material specifications.')).toBeInTheDocument();
  });

  it('renders reviewed date when provided', () => {
    render(<RejectionFeedbackPanel {...defaultProps} />);
    expect(screen.getByText(/Mar 1, 2026/)).toBeInTheDocument();
  });

  it('does not render date when reviewedAt is null', () => {
    render(<RejectionFeedbackPanel {...defaultProps} reviewedAt={null} />);
    expect(screen.queryByText(/Mar/)).not.toBeInTheDocument();
  });

  it('has accessible region label', () => {
    render(<RejectionFeedbackPanel {...defaultProps} />);
    expect(screen.getByRole('region', { name: 'Rejection feedback' })).toBeInTheDocument();
  });

  it('renders the rejection heading', () => {
    render(<RejectionFeedbackPanel {...defaultProps} />);
    expect(screen.getByText('Campaign Rejected')).toBeInTheDocument();
  });

  it('renders section headings', () => {
    render(<RejectionFeedbackPanel {...defaultProps} />);
    expect(screen.getByText('Reason for Rejection')).toBeInTheDocument();
    expect(screen.getByText('How to Improve Your Proposal')).toBeInTheDocument();
  });
});
