import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ReviewActionPanel } from './ReviewActionPanel';

const defaultProps = {
  campaignId: '550e8400-e29b-41d4-a716-446655440001',
  onApprove: vi.fn(),
  onReject: vi.fn(),
  isLoading: false,
};

describe('ReviewActionPanel', () => {
  it('renders approve and reject tabs', () => {
    render(<ReviewActionPanel {...defaultProps} />);
    expect(screen.getByRole('tab', { name: /Approve/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Reject/i })).toBeInTheDocument();
  });

  it('approve button is disabled when review notes are empty', () => {
    render(<ReviewActionPanel {...defaultProps} />);
    const approveBtn = screen.getByRole('button', { name: 'Approve this campaign' });
    expect(approveBtn).toBeDisabled();
  });

  it('approve button is enabled when review notes are non-empty', async () => {
    render(<ReviewActionPanel {...defaultProps} />);
    const textarea = screen.getByRole('textbox', { name: /Review Notes/i });
    await userEvent.type(textarea, 'This campaign meets all requirements.');
    const approveBtn = screen.getByRole('button', { name: 'Approve this campaign' });
    expect(approveBtn).not.toBeDisabled();
  });

  it('calls onApprove with review notes when approve button is clicked', async () => {
    const onApprove = vi.fn();
    render(<ReviewActionPanel {...defaultProps} onApprove={onApprove} />);
    await userEvent.type(screen.getByRole('textbox', { name: /Review Notes/i }), 'All good');
    await userEvent.click(screen.getByRole('button', { name: 'Approve this campaign' }));
    expect(onApprove).toHaveBeenCalledWith('All good');
  });

  it('reject tab is accessible', async () => {
    render(<ReviewActionPanel {...defaultProps} />);
    await userEvent.click(screen.getByRole('tab', { name: /Reject/i }));
    expect(screen.getByRole('tab', { name: /Reject/i })).toHaveAttribute('aria-selected', 'true');
  });

  it('reject button is disabled when both fields are empty', async () => {
    render(<ReviewActionPanel {...defaultProps} />);
    await userEvent.click(screen.getByRole('tab', { name: /Reject/i }));
    expect(screen.getByRole('button', { name: 'Reject this campaign' })).toBeDisabled();
  });

  it('reject button is disabled when only rejection reason is filled', async () => {
    render(<ReviewActionPanel {...defaultProps} />);
    await userEvent.click(screen.getByRole('tab', { name: /Reject/i }));
    await userEvent.type(screen.getByRole('textbox', { name: /Rejection Reason/i }), 'Missing data');
    expect(screen.getByRole('button', { name: 'Reject this campaign' })).toBeDisabled();
  });

  it('reject button is disabled when only guidance is filled', async () => {
    render(<ReviewActionPanel {...defaultProps} />);
    await userEvent.click(screen.getByRole('tab', { name: /Reject/i }));
    await userEvent.type(screen.getByRole('textbox', { name: /Resubmission Guidance/i }), 'Add more details');
    expect(screen.getByRole('button', { name: 'Reject this campaign' })).toBeDisabled();
  });

  it('reject button is enabled when both fields are non-empty', async () => {
    render(<ReviewActionPanel {...defaultProps} />);
    await userEvent.click(screen.getByRole('tab', { name: /Reject/i }));
    await userEvent.type(screen.getByRole('textbox', { name: /Rejection Reason/i }), 'Missing data');
    await userEvent.type(screen.getByRole('textbox', { name: /Resubmission Guidance/i }), 'Add more details');
    expect(screen.getByRole('button', { name: 'Reject this campaign' })).not.toBeDisabled();
  });

  it('calls onReject with both fields when reject button is clicked', async () => {
    const onReject = vi.fn();
    render(<ReviewActionPanel {...defaultProps} onReject={onReject} />);
    await userEvent.click(screen.getByRole('tab', { name: /Reject/i }));
    await userEvent.type(screen.getByRole('textbox', { name: /Rejection Reason/i }), 'Not enough detail');
    await userEvent.type(screen.getByRole('textbox', { name: /Resubmission Guidance/i }), 'Add technical specs');
    await userEvent.click(screen.getByRole('button', { name: 'Reject this campaign' }));
    expect(onReject).toHaveBeenCalledWith('Not enough detail', 'Add technical specs');
  });

  it('all buttons are disabled when isLoading is true', async () => {
    render(<ReviewActionPanel {...defaultProps} isLoading={true} />);
    await userEvent.type(screen.getByRole('textbox', { name: /Review Notes/i }), 'Notes');
    expect(screen.getByRole('button', { name: 'Approve this campaign' })).toBeDisabled();
  });
});
