import { render, screen } from '@testing-library/react';
import { LoadingSpinner } from './loading-spinner.js';

describe('LoadingSpinner', () => {
  it('renders with default label "Loading"', () => {
    render(<LoadingSpinner />);
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
  });

  it('renders with a custom label', () => {
    render(<LoadingSpinner label="Please wait" />);
    expect(screen.getByRole('status', { name: 'Please wait' })).toBeInTheDocument();
  });

  it('sets aria-busy="true" on the container', () => {
    const { container } = render(<LoadingSpinner />);
    const busyEl = container.querySelector('[aria-busy="true"]');
    expect(busyEl).toBeInTheDocument();
  });

  it('renders the SVG spinner', () => {
    render(<LoadingSpinner />);
    const svg = screen.getByRole('status');
    expect(svg.tagName.toLowerCase()).toBe('svg');
  });

  it('uses md size (40px) by default', () => {
    render(<LoadingSpinner />);
    const svg = screen.getByRole('status');
    expect(svg).toHaveAttribute('width', '40');
    expect(svg).toHaveAttribute('height', '40');
  });

  it('uses sm size (24px) when size="sm"', () => {
    render(<LoadingSpinner size="sm" />);
    const svg = screen.getByRole('status');
    expect(svg).toHaveAttribute('width', '24');
    expect(svg).toHaveAttribute('height', '24');
  });

  it('uses lg size (56px) when size="lg"', () => {
    render(<LoadingSpinner size="lg" />);
    const svg = screen.getByRole('status');
    expect(svg).toHaveAttribute('width', '56');
    expect(svg).toHaveAttribute('height', '56');
  });
});
