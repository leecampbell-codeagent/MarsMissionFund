import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { FundingProgressBar } from './FundingProgressBar';

describe('FundingProgressBar', () => {
  it('renders with zero progress when totalRaisedCents is 0', () => {
    render(
      <FundingProgressBar
        fundingPercentage={0}
        totalRaisedCents="0"
        fundingGoalCents="310840000"
        contributorCount={0}
      />,
    );
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '0');
    expect(screen.getByText('$0.00')).toBeInTheDocument();
    expect(screen.getByText(/\$3,108,400/)).toBeInTheDocument();
  });

  it('renders correct funding amount and goal', () => {
    render(
      <FundingProgressBar
        fundingPercentage={42}
        totalRaisedCents="130552800"
        fundingGoalCents="310840000"
        contributorCount={317}
      />,
    );
    expect(screen.getByText(/\$1,305,528/)).toBeInTheDocument();
    expect(screen.getByText(/\$3,108,400/)).toBeInTheDocument();
    expect(screen.getByText('42%')).toBeInTheDocument();
    expect(screen.getByText('317 backers')).toBeInTheDocument();
  });

  it('caps progress bar visually at 100% when fundingPercentage > 100', () => {
    render(
      <FundingProgressBar
        fundingPercentage={127}
        totalRaisedCents="394767400"
        fundingGoalCents="310840000"
        contributorCount={892}
      />,
    );
    const bar = screen.getByRole('progressbar');
    // aria-valuenow is clamped to 100
    expect(bar).toHaveAttribute('aria-valuenow', '100');
    // text still shows actual percentage
    expect(screen.getByText('127%')).toBeInTheDocument();
  });

  it('displays N/A for null fundingPercentage', () => {
    render(
      <FundingProgressBar
        fundingPercentage={null}
        totalRaisedCents="0"
        fundingGoalCents={null}
        contributorCount={0}
      />,
    );
    expect(screen.getByText('N/A')).toBeInTheDocument();
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '0');
  });

  it('does not show goal when fundingGoalCents is null', () => {
    render(
      <FundingProgressBar
        fundingPercentage={null}
        totalRaisedCents="0"
        fundingGoalCents={null}
        contributorCount={5}
      />,
    );
    expect(screen.queryByText(/goal/i)).not.toBeInTheDocument();
    expect(screen.getByText('5 backers')).toBeInTheDocument();
  });

  it('shows singular "backer" for 1 contributor', () => {
    render(
      <FundingProgressBar
        fundingPercentage={10}
        totalRaisedCents="31084000"
        fundingGoalCents="310840000"
        contributorCount={1}
      />,
    );
    expect(screen.getByText('1 backer')).toBeInTheDocument();
  });

  it('renders progress bar at 0% for zero raised amount', () => {
    render(
      <FundingProgressBar
        fundingPercentage={0}
        totalRaisedCents="0"
        fundingGoalCents="500000000"
        contributorCount={0}
      />,
    );
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '0');
    expect(screen.getByText('0%')).toBeInTheDocument();
  });
});
