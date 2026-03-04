import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DashboardPlaceholder from './dashboard';

// Mock @clerk/clerk-react
const mockUseUser = vi.fn();
vi.mock('@clerk/clerk-react', () => ({
  useUser: () => mockUseUser(),
}));

describe('DashboardPlaceholder', () => {
  it('renders the welcome heading', () => {
    mockUseUser.mockReturnValue({
      user: { primaryEmailAddress: { emailAddress: 'test@example.com' }, fullName: null },
      isLoaded: true,
    });

    render(<DashboardPlaceholder />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'WELCOME TO MARS MISSION FUND',
    );
  });

  it('displays user email when loaded', () => {
    mockUseUser.mockReturnValue({
      user: { primaryEmailAddress: { emailAddress: 'operative@mars.fund' }, fullName: null },
      isLoaded: true,
    });

    render(<DashboardPlaceholder />);
    expect(screen.getByText('Signed in as operative@mars.fund')).toBeInTheDocument();
  });

  it('displays placeholder dash while loading', () => {
    mockUseUser.mockReturnValue({
      user: null,
      isLoaded: false,
    });

    render(<DashboardPlaceholder />);
    expect(screen.getByText('\u2014')).toBeInTheDocument();
  });

  it('falls back to Mission Operative when no email or name', () => {
    mockUseUser.mockReturnValue({
      user: { primaryEmailAddress: null, fullName: null },
      isLoaded: true,
    });

    render(<DashboardPlaceholder />);
    expect(screen.getByText('Signed in as Mission Operative')).toBeInTheDocument();
  });

  it('falls back to fullName when no email', () => {
    mockUseUser.mockReturnValue({
      user: { primaryEmailAddress: null, fullName: 'Jane Doe' },
      isLoaded: true,
    });

    render(<DashboardPlaceholder />);
    expect(screen.getByText('Signed in as Jane Doe')).toBeInTheDocument();
  });
});
