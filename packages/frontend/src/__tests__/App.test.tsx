import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { App } from '../App';

describe('App', () => {
  it('renders the hero heading', () => {
    render(<App />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('MARS MISSION FUND');
  });

  it('renders the page shell with header and footer', () => {
    render(<App />);

    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });
});
