import { render, screen } from '@testing-library/react';
import { App } from './App.js';

describe('App', () => {
  it('renders without throwing', () => {
    expect(() => render(<App />)).not.toThrow();
  });

  it('renders element containing "Mars Mission Fund"', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Mars Mission Fund' })).toBeInTheDocument();
  });
});
