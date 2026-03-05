import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../App';

// Mock @clerk/clerk-react — App uses PageShell which has HeaderAuthSection,
// plus ProtectedRoute and PublicOnlyRoute which use useAuth
vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ isLoaded: true, isSignedIn: false }),
  useUser: () => ({ user: null, isLoaded: false }),
  UserButton: () => <div data-testid="clerk-user-button">UserButton</div>,
  SignIn: () => <div data-testid="clerk-sign-in">SignIn</div>,
  SignUp: () => <div data-testid="clerk-sign-up">SignUp</div>,
}));

describe('App', () => {
  it('renders the hero heading on the landing page', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('MARS MISSION FUND');
  });

  it('renders the page shell with header and footer', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });
});
