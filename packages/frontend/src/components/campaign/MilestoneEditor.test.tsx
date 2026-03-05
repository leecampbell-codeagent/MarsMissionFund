import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MilestoneEditor } from './MilestoneEditor';
import type { MilestoneFormItem } from './MilestoneEditor';

function makeItems(count: number): MilestoneFormItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `m-${i}`,
    title: `Milestone ${i + 1}`,
    description: '',
    targetDate: '2026-09-01',
    fundingPercentage: count === 2 ? '50' : String(Math.floor(100 / count)),
    verificationCriteria: '',
  }));
}

describe('MilestoneEditor', () => {
  it('renders add milestone button when empty', () => {
    render(<MilestoneEditor milestones={[]} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /add milestone/i })).toBeInTheDocument();
  });

  it('renders milestone rows for each milestone', () => {
    const items = makeItems(2);
    render(<MilestoneEditor milestones={items} onChange={vi.fn()} />);
    expect(screen.getByText('MILESTONE 1')).toBeInTheDocument();
    expect(screen.getByText('MILESTONE 2')).toBeInTheDocument();
  });

  it('shows valid total indicator when percentages sum to 100', () => {
    const items = makeItems(2);
    render(<MilestoneEditor milestones={items} onChange={vi.fn()} />);
    expect(screen.getByText(/TOTAL: 100% \/ 100%/i)).toBeInTheDocument();
  });

  it('shows invalid total indicator when percentages do not sum to 100', () => {
    const items: MilestoneFormItem[] = [
      { id: 'm-0', title: 'M1', description: '', targetDate: '', fundingPercentage: '40', verificationCriteria: '' },
      { id: 'm-1', title: 'M2', description: '', targetDate: '', fundingPercentage: '40', verificationCriteria: '' },
    ];
    render(<MilestoneEditor milestones={items} onChange={vi.fn()} />);
    expect(screen.getByText(/TOTAL: 80% \/ 100%/i)).toBeInTheDocument();
  });

  it('calls onChange when add milestone is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<MilestoneEditor milestones={[]} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: /add milestone/i }));
    expect(onChange).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ title: '', fundingPercentage: '' }),
    ]));
  });

  it('does not show remove button when only one milestone', () => {
    const items = makeItems(1);
    render(<MilestoneEditor milestones={items} onChange={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /remove milestone/i })).not.toBeInTheDocument();
  });

  it('shows remove buttons when multiple milestones', () => {
    const items = makeItems(2);
    render(<MilestoneEditor milestones={items} onChange={vi.fn()} />);
    expect(screen.getAllByRole('button', { name: /remove milestone/i })).toHaveLength(2);
  });

  it('disables inputs when disabled prop is true', () => {
    const items = makeItems(1);
    render(<MilestoneEditor milestones={items} onChange={vi.fn()} disabled={true} />);
    const addBtn = screen.getByRole('button', { name: /add milestone/i });
    expect(addBtn).toBeDisabled();
  });
});
