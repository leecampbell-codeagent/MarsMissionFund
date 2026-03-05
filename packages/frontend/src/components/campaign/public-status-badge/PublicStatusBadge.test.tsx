import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PublicStatusBadge } from './PublicStatusBadge';

describe('PublicStatusBadge', () => {
  it('renders "Fully Funded" for funded status', () => {
    render(<PublicStatusBadge status="funded" />);
    expect(
      screen.getByRole('status', { name: 'Campaign status: Fully Funded' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Fully Funded')).toBeInTheDocument();
  });

  it('renders "Ending Soon" for live status with daysRemaining <= 7', () => {
    render(<PublicStatusBadge status="live" daysRemaining={3} />);
    expect(
      screen.getByRole('status', { name: 'Campaign status: Ending Soon' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Ending Soon')).toBeInTheDocument();
  });

  it('renders "Ending Soon" for live status with daysRemaining === 0', () => {
    render(<PublicStatusBadge status="live" daysRemaining={0} />);
    expect(screen.getByText('Ending Soon')).toBeInTheDocument();
  });

  it('renders "Live" for live status with daysRemaining > 7', () => {
    render(<PublicStatusBadge status="live" daysRemaining={30} />);
    expect(screen.getByRole('status', { name: 'Campaign status: Live' })).toBeInTheDocument();
    expect(screen.getByText('Live')).toBeInTheDocument();
  });

  it('renders "Live" for live status with null daysRemaining', () => {
    render(<PublicStatusBadge status="live" daysRemaining={null} />);
    expect(screen.getByText('Live')).toBeInTheDocument();
  });

  it('renders "Live" for live status with no daysRemaining prop', () => {
    render(<PublicStatusBadge status="live" />);
    expect(screen.getByText('Live')).toBeInTheDocument();
  });

  it('does NOT render "Ending Soon" when daysRemaining > 7', () => {
    render(<PublicStatusBadge status="live" daysRemaining={14} />);
    expect(screen.queryByText('Ending Soon')).not.toBeInTheDocument();
    expect(screen.getByText('Live')).toBeInTheDocument();
  });
});
