import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Milestone } from '../../../types/campaign';
import { MilestoneList } from './MilestoneList';

const mockMilestones: Milestone[] = [
  {
    id: '550e8400-e29b-41d4-a716-446655440030',
    title: 'Prototype Complete',
    description: 'Initial working prototype delivered',
    fundingBasisPoints: 2500,
    targetDate: '2026-06-01',
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440031',
    title: 'Flight Test',
    description: 'First atmospheric test flight',
    fundingBasisPoints: 7500,
    targetDate: null,
  },
];

describe('MilestoneList', () => {
  it('renders empty state when no milestones', () => {
    render(<MilestoneList milestones={[]} />);
    expect(screen.getByText('No milestones defined.')).toBeInTheDocument();
  });

  it('renders each milestone title', () => {
    render(<MilestoneList milestones={mockMilestones} />);
    expect(screen.getByText(/Prototype Complete/)).toBeInTheDocument();
    expect(screen.getByText(/Flight Test/)).toBeInTheDocument();
  });

  it('renders basis points as percentage for each milestone', () => {
    render(<MilestoneList milestones={mockMilestones} />);
    expect(screen.getByLabelText('Funding allocation: 25.00%')).toBeInTheDocument();
    expect(screen.getByLabelText('Funding allocation: 75.00%')).toBeInTheDocument();
  });

  it('renders milestone descriptions', () => {
    render(<MilestoneList milestones={mockMilestones} />);
    expect(screen.getByText('Initial working prototype delivered')).toBeInTheDocument();
    expect(screen.getByText('First atmospheric test flight')).toBeInTheDocument();
  });

  it('renders target date when present', () => {
    render(<MilestoneList milestones={mockMilestones} />);
    expect(screen.getByText(/Target:/)).toBeInTheDocument();
    expect(screen.getByText(/Jun 1, 2026/)).toBeInTheDocument();
  });

  it('does not render target date when null', () => {
    const noDateMilestone = mockMilestones[1];
    if (!noDateMilestone) return;
    render(<MilestoneList milestones={[noDateMilestone]} />);
    expect(screen.queryByText(/Target:/)).not.toBeInTheDocument();
  });

  it('renders milestone numbering', () => {
    render(<MilestoneList milestones={mockMilestones} />);
    expect(screen.getByText(/1\. Prototype Complete/)).toBeInTheDocument();
    expect(screen.getByText(/2\. Flight Test/)).toBeInTheDocument();
  });

  it('renders list with correct aria label', () => {
    render(<MilestoneList milestones={mockMilestones} />);
    expect(screen.getByRole('list', { name: 'Campaign milestones' })).toBeInTheDocument();
  });
});
