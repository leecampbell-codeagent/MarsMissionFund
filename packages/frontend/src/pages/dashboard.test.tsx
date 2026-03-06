import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import DashboardPage from './dashboard.js';

// Mock @clerk/react
vi.mock('@clerk/react', () => ({
  useUser: vi.fn(),
  useClerk: vi.fn(),
}));

import { useClerk, useUser } from '@clerk/react';

const mockUseUser = vi.mocked(useUser);
const mockUseClerk = vi.mocked(useClerk);

describe('DashboardPage', () => {
  const mockSignOut = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    mockUseClerk.mockReturnValue({
      signOut: mockSignOut,
    } as unknown as ReturnType<typeof useClerk>);
    mockUseUser.mockReturnValue({
      user: {
        primaryEmailAddress: { emailAddress: 'backer@example.com' },
      },
      isLoaded: true,
      isSignedIn: true,
    } as unknown as ReturnType<typeof useUser>);
  });

  it('renders the DASHBOARD heading', () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'DASHBOARD' })).toBeInTheDocument();
  });

  it('displays the user email address', () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('backer@example.com')).toBeInTheDocument();
  });

  it('renders the coming soon card', () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('region', { name: 'Feature status' })).toBeInTheDocument();
    expect(screen.getByText('COMING SOON')).toBeInTheDocument();
  });

  it('renders the Sign Out button', () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: 'Sign Out' })).toBeInTheDocument();
  });

  it('calls signOut when Sign Out button is clicked', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Sign Out' }));

    expect(mockSignOut).toHaveBeenCalledOnce();
  });

  it('does not render email line when user has no email', () => {
    mockUseUser.mockReturnValue({
      user: {
        primaryEmailAddress: null,
      },
      isLoaded: true,
      isSignedIn: true,
    } as unknown as ReturnType<typeof useUser>);

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(screen.queryByText('Signed in as')).not.toBeInTheDocument();
  });

  it('does not render email line when user is null', () => {
    mockUseUser.mockReturnValue({
      user: null,
      isLoaded: false,
      isSignedIn: false,
    } as unknown as ReturnType<typeof useUser>);

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(screen.queryByText('Signed in as')).not.toBeInTheDocument();
  });
});
