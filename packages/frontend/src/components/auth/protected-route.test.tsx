import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ProtectedRoute } from './protected-route';

// Mock @clerk/clerk-react
const mockUseAuth = vi.fn();
vi.mock('@clerk/clerk-react', () => ({
  useAuth: (): ReturnType<typeof mockUseAuth> => mockUseAuth(),
}));

function renderWithRouter(ui: React.ReactElement, initialEntries = ['/dashboard']) {
  return render(<MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>);
}

describe('ProtectedRoute', () => {
  it('shows loading screen while auth is loading', () => {
    mockUseAuth.mockReturnValue({ isLoaded: false, isSignedIn: false });

    renderWithRouter(
      <ProtectedRoute>
        <div>protected content</div>
      </ProtectedRoute>,
    );

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Preparing your mission...')).toBeInTheDocument();
    expect(screen.queryByText('protected content')).not.toBeInTheDocument();
  });

  it('renders children when authenticated', () => {
    mockUseAuth.mockReturnValue({ isLoaded: true, isSignedIn: true });

    renderWithRouter(
      <ProtectedRoute>
        <div>protected content</div>
      </ProtectedRoute>,
    );

    expect(screen.getByText('protected content')).toBeInTheDocument();
  });

  it('redirects to /sign-in when not authenticated', () => {
    mockUseAuth.mockReturnValue({ isLoaded: true, isSignedIn: false });

    renderWithRouter(
      <ProtectedRoute>
        <div>protected content</div>
      </ProtectedRoute>,
    );

    expect(screen.queryByText('protected content')).not.toBeInTheDocument();
  });
});
