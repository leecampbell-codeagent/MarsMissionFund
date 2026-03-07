import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Mock heavy dependencies before module loading
vi.mock('@clerk/react', () => ({
  useAuth: () => mockAuthState,
}));

vi.mock('react-router', () => ({
  Navigate: ({ to }: { to: string }) => <div data-testid="navigate" data-to={to} />,
  useLocation: () => ({
    pathname: '/dashboard',
    search: '',
    hash: '',
    state: null,
    key: 'default',
  }),
}));

vi.mock('./AuthLoadingScreen', () => ({
  AuthLoadingScreen: () => <output aria-busy="true" aria-label="Loading" />,
}));

const mockAuthState = {
  isLoaded: true as boolean,
  isSignedIn: false as boolean,
};

import { ProtectedRoute } from './ProtectedRoute';

afterEach(() => {
  cleanup();
});

describe('ProtectedRoute', () => {
  it('renders loading screen while Clerk is initialising', () => {
    mockAuthState.isLoaded = false;
    mockAuthState.isSignedIn = false;

    render(
      <div>
        <ProtectedRoute>
          <div>Protected content</div>
        </ProtectedRoute>
      </div>,
    );

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });

  it('redirects to /sign-in when not authenticated', () => {
    mockAuthState.isLoaded = true;
    mockAuthState.isSignedIn = false;

    render(
      <div>
        <ProtectedRoute>
          <div>Protected content</div>
        </ProtectedRoute>
      </div>,
    );

    expect(screen.getByTestId('navigate')).toHaveAttribute('data-to', '/sign-in');
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });

  it('renders children when authenticated', () => {
    mockAuthState.isLoaded = true;
    mockAuthState.isSignedIn = true;

    render(
      <div>
        <ProtectedRoute>
          <div>Protected content</div>
        </ProtectedRoute>
      </div>,
    );

    expect(screen.getByText('Protected content')).toBeInTheDocument();
  });
});
