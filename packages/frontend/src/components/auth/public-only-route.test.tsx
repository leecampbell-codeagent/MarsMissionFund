import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { PublicOnlyRoute } from './public-only-route';

// Mock @clerk/clerk-react
const mockUseAuth = vi.fn();
vi.mock('@clerk/clerk-react', () => ({
  useAuth: (): ReturnType<typeof mockUseAuth> => mockUseAuth(),
}));

function renderWithRouter(ui: React.ReactElement, initialEntries = ['/sign-in']) {
  return render(<MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>);
}

describe('PublicOnlyRoute', () => {
  it('shows loading screen while auth is loading', () => {
    mockUseAuth.mockReturnValue({ isLoaded: false, isSignedIn: false });

    renderWithRouter(
      <PublicOnlyRoute>
        <div>public content</div>
      </PublicOnlyRoute>,
    );

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('public content')).not.toBeInTheDocument();
  });

  it('renders children when not authenticated', () => {
    mockUseAuth.mockReturnValue({ isLoaded: true, isSignedIn: false });

    renderWithRouter(
      <PublicOnlyRoute>
        <div>public content</div>
      </PublicOnlyRoute>,
    );

    expect(screen.getByText('public content')).toBeInTheDocument();
  });

  it('redirects to /dashboard when authenticated', () => {
    mockUseAuth.mockReturnValue({ isLoaded: true, isSignedIn: true });

    renderWithRouter(
      <PublicOnlyRoute>
        <div>public content</div>
      </PublicOnlyRoute>,
    );

    expect(screen.queryByText('public content')).not.toBeInTheDocument();
  });
});
