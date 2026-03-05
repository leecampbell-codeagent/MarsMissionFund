import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AuthLoadingScreen } from './auth-loading-screen';

describe('AuthLoadingScreen', () => {
  it('renders with status role and accessible label', () => {
    render(<AuthLoadingScreen />);
    const container = screen.getByRole('status');
    expect(container).toHaveAttribute('aria-label', 'Checking authentication');
  });

  it('displays the loading text', () => {
    render(<AuthLoadingScreen />);
    expect(screen.getByText('Preparing your mission...')).toBeInTheDocument();
  });

  it('renders the spinner element', () => {
    const { container } = render(<AuthLoadingScreen />);
    const spinner = container.querySelector('.auth-loading-screen__spinner');
    expect(spinner).toBeInTheDocument();
  });
});
