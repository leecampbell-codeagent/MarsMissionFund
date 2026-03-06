import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { Header } from './header.js';

// Mock @clerk/react
vi.mock('@clerk/react', () => ({
  useAuth: vi.fn(),
  useClerk: vi.fn(),
  useUser: vi.fn(),
}));

import { useAuth, useClerk, useUser } from '@clerk/react';

const mockUseAuth = vi.mocked(useAuth);
const mockUseClerk = vi.mocked(useClerk);
const mockUseUser = vi.mocked(useUser);

describe('Header', () => {
  beforeEach(() => {
    mockUseClerk.mockReturnValue({
      signOut: vi.fn().mockResolvedValue(undefined),
    } as unknown as ReturnType<typeof useClerk>);
    mockUseUser.mockReturnValue({
      user: null,
      isLoaded: true,
      isSignedIn: false,
    } as unknown as ReturnType<typeof useUser>);
  });

  it('renders "Sign In" link when isSignedIn is false', () => {
    mockUseAuth.mockReturnValue({
      isLoaded: true,
      isSignedIn: false,
    } as unknown as ReturnType<typeof useAuth>);

    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Sign In' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sign Out' })).not.toBeInTheDocument();
  });

  it('renders "Sign Out" button when isSignedIn is true', () => {
    mockUseAuth.mockReturnValue({
      isLoaded: true,
      isSignedIn: true,
    } as unknown as ReturnType<typeof useAuth>);
    mockUseUser.mockReturnValue({
      user: {
        primaryEmailAddress: { emailAddress: 'test@example.com' },
      },
      isLoaded: true,
      isSignedIn: true,
    } as unknown as ReturnType<typeof useUser>);

    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: 'Sign Out' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Sign In' })).not.toBeInTheDocument();
  });

  it('renders nothing for auth controls when isLoaded is false', () => {
    mockUseAuth.mockReturnValue({
      isLoaded: false,
      isSignedIn: false,
    } as unknown as ReturnType<typeof useAuth>);

    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('link', { name: 'Sign In' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sign Out' })).not.toBeInTheDocument();
  });

  it('clicking "Sign Out" calls signOut() and navigates to /sign-in', async () => {
    const user = userEvent.setup();
    const mockSignOut = vi.fn().mockResolvedValue(undefined);
    mockUseClerk.mockReturnValue({
      signOut: mockSignOut,
    } as unknown as ReturnType<typeof useClerk>);
    mockUseAuth.mockReturnValue({
      isLoaded: true,
      isSignedIn: true,
    } as unknown as ReturnType<typeof useAuth>);
    mockUseUser.mockReturnValue({
      user: {
        primaryEmailAddress: { emailAddress: 'test@example.com' },
      },
      isLoaded: true,
      isSignedIn: true,
    } as unknown as ReturnType<typeof useUser>);

    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Sign Out' }));

    expect(mockSignOut).toHaveBeenCalledOnce();
  });

  it('renders the MMF wordmark and logo link', () => {
    mockUseAuth.mockReturnValue({
      isLoaded: true,
      isSignedIn: false,
    } as unknown as ReturnType<typeof useAuth>);

    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Mars Mission Fund — home' })).toBeInTheDocument();
  });
});
