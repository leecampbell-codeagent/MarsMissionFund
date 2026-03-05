import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { HeaderAuthSection } from './header-auth-section';

// Mock @clerk/clerk-react
const mockUseAuth = vi.fn();
vi.mock('@clerk/clerk-react', () => ({
  useAuth: (): ReturnType<typeof mockUseAuth> => mockUseAuth(),
  UserButton: () => <div data-testid="clerk-user-button">UserButton</div>,
}));

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('HeaderAuthSection', () => {
  it('renders empty space while auth is loading', () => {
    mockUseAuth.mockReturnValue({ isLoaded: false, isSignedIn: false });

    const { container } = renderWithRouter(<HeaderAuthSection />);

    const section = container.querySelector('.header-auth-section');
    expect(section).toBeInTheDocument();
    expect(screen.queryByText('Sign In')).not.toBeInTheDocument();
    expect(screen.queryByTestId('clerk-user-button')).not.toBeInTheDocument();
  });

  it('renders Sign In link when signed out', () => {
    mockUseAuth.mockReturnValue({ isLoaded: true, isSignedIn: false });

    renderWithRouter(<HeaderAuthSection />);

    const signInLink = screen.getByText('Sign In');
    expect(signInLink).toBeInTheDocument();
    expect(signInLink.tagName).toBe('A');
    expect(signInLink).toHaveAttribute('href', '/sign-in');
  });

  it('renders UserButton when signed in', () => {
    mockUseAuth.mockReturnValue({ isLoaded: true, isSignedIn: true });

    renderWithRouter(<HeaderAuthSection />);

    expect(screen.getByTestId('clerk-user-button')).toBeInTheDocument();
    expect(screen.queryByText('Sign In')).not.toBeInTheDocument();
  });
});
