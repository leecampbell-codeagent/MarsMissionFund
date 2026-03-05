import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LandingPlaceholder } from './landing-placeholder';

describe('LandingPlaceholder', () => {
  it('renders the hero title', () => {
    render(<LandingPlaceholder />);

    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveTextContent('MARS MISSION FUND');
  });

  it('renders the subtitle text', () => {
    render(<LandingPlaceholder />);

    expect(screen.getByText('Crowdfunding the Next Giant Leap')).toBeInTheDocument();
  });

  it('has a single h1 element on the page', () => {
    render(<LandingPlaceholder />);

    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
  });

  it('renders within a section element', () => {
    const { container } = render(<LandingPlaceholder />);

    const section = container.querySelector('section');
    expect(section).toBeInTheDocument();
  });
});
