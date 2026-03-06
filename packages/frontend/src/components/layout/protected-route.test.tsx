import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { ProtectedRoute } from './protected-route.js';

// Mock @clerk/react
vi.mock('@clerk/react', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '@clerk/react';

const mockUseAuth = vi.mocked(useAuth);

describe('ProtectedRoute', () => {
  it('shows loading spinner when isLoaded is false', () => {
    mockUseAuth.mockReturnValue({
      isLoaded: false,
      isSignedIn: false,
    } as unknown as ReturnType<typeof useAuth>);

    render(
      <MemoryRouter>
        <ProtectedRoute>
          <div>Protected content</div>
        </ProtectedRoute>
      </MemoryRouter>,
    );

    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });

  it('redirects to /sign-in when isSignedIn is false and isLoaded is true', () => {
    mockUseAuth.mockReturnValue({
      isLoaded: true,
      isSignedIn: false,
    } as unknown as ReturnType<typeof useAuth>);

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <ProtectedRoute>
          <div>Protected content</div>
        </ProtectedRoute>
      </MemoryRouter>,
    );

    // Content should not render
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
    // Spinner should not render
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('renders children when isSignedIn is true and isLoaded is true', () => {
    mockUseAuth.mockReturnValue({
      isLoaded: true,
      isSignedIn: true,
    } as unknown as ReturnType<typeof useAuth>);

    render(
      <MemoryRouter>
        <ProtectedRoute>
          <div>Protected content</div>
        </ProtectedRoute>
      </MemoryRouter>,
    );

    expect(screen.getByText('Protected content')).toBeInTheDocument();
  });
});
