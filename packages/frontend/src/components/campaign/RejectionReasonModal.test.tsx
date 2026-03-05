import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RejectionReasonModal } from './RejectionReasonModal';

describe('RejectionReasonModal', () => {
  it('renders nothing when isOpen is false', () => {
    render(
      <RejectionReasonModal
        isOpen={false}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        isPending={false}
      />,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders modal when isOpen is true', () => {
    render(
      <RejectionReasonModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        isPending={false}
      />,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('REJECT CAMPAIGN')).toBeInTheDocument();
  });

  it('renders textarea and confirm/cancel buttons', () => {
    render(
      <RejectionReasonModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        isPending={false}
      />,
    );
    expect(screen.getByLabelText(/rejection rationale/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirm rejection/i })).toBeInTheDocument();
  });

  it('confirm button is disabled when textarea is empty', () => {
    render(
      <RejectionReasonModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        isPending={false}
      />,
    );
    expect(screen.getByRole('button', { name: /confirm rejection/i })).toBeDisabled();
  });

  it('confirm button is enabled when textarea has content', async () => {
    const user = userEvent.setup();
    render(
      <RejectionReasonModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        isPending={false}
      />,
    );
    await user.type(screen.getByLabelText(/rejection rationale/i), 'Missing team details.');
    expect(screen.getByRole('button', { name: /confirm rejection/i })).not.toBeDisabled();
  });

  it('calls onConfirm with trimmed comment when confirmed', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <RejectionReasonModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={onConfirm}
        isPending={false}
      />,
    );
    await user.type(screen.getByLabelText(/rejection rationale/i), '  Missing credentials.  ');
    await user.click(screen.getByRole('button', { name: /confirm rejection/i }));
    expect(onConfirm).toHaveBeenCalledWith('Missing credentials.');
  });

  it('calls onClose when Cancel is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <RejectionReasonModal
        isOpen={true}
        onClose={onClose}
        onConfirm={vi.fn()}
        isPending={false}
      />,
    );
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('disables all interactions when isPending is true', () => {
    render(
      <RejectionReasonModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        isPending={true}
      />,
    );
    expect(screen.getByLabelText(/rejection rationale/i)).toBeDisabled();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
  });

  it('shows character count', () => {
    render(
      <RejectionReasonModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        isPending={false}
      />,
    );
    expect(screen.getByText(/0 \/ 5000 chars/)).toBeInTheDocument();
  });

  it('updates character count as user types', async () => {
    const user = userEvent.setup();
    render(
      <RejectionReasonModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        isPending={false}
      />,
    );
    await user.type(screen.getByLabelText(/rejection rationale/i), 'Hello');
    expect(screen.getByText(/5 \/ 5000 chars/)).toBeInTheDocument();
  });
});
