import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CategoryFilter } from './CategoryFilter';

describe('CategoryFilter', () => {
  it('renders all category options', () => {
    const onChange = vi.fn();
    render(<CategoryFilter selected={[]} onChange={onChange} />);
    expect(screen.getByRole('button', { name: /Propulsion/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Robotics & Automation/i })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Communications & Navigation/i }),
    ).toBeInTheDocument();
  });

  it('shows active state for selected categories', () => {
    const onChange = vi.fn();
    render(<CategoryFilter selected={['propulsion']} onChange={onChange} />);
    const propulsionBtn = screen.getByRole('button', { name: /Filter by Propulsion/i });
    expect(propulsionBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows inactive state for unselected categories', () => {
    const onChange = vi.fn();
    render(<CategoryFilter selected={[]} onChange={onChange} />);
    const propulsionBtn = screen.getByRole('button', { name: /Filter by Propulsion/i });
    expect(propulsionBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls onChange with added category when an inactive category is clicked', async () => {
    const onChange = vi.fn();
    render(<CategoryFilter selected={[]} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: /Filter by Propulsion/i }));
    expect(onChange).toHaveBeenCalledWith(['propulsion']);
  });

  it('calls onChange with category removed when an active category is clicked', async () => {
    const onChange = vi.fn();
    render(<CategoryFilter selected={['propulsion', 'power_energy']} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: /Filter by Propulsion/i }));
    expect(onChange).toHaveBeenCalledWith(['power_energy']);
  });

  it('supports multiple selected categories', () => {
    const onChange = vi.fn();
    render(<CategoryFilter selected={['propulsion', 'robotics_automation']} onChange={onChange} />);
    expect(screen.getByRole('button', { name: /Filter by Propulsion/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(
      screen.getByRole('button', { name: /Filter by Robotics & Automation/i }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Filter by Power & Energy/i })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('renders "Category" legend', () => {
    const onChange = vi.fn();
    render(<CategoryFilter selected={[]} onChange={onChange} />);
    expect(screen.getByText('Category')).toBeInTheDocument();
  });
});
