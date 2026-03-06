import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { OnboardingGuard } from './onboarding-guard.js';

vi.mock('../../hooks/use-current-user.js', () => ({
  useCurrentUser: vi.fn(),
}));

import { useCurrentUser } from '../../hooks/use-current-user.js';

const mockUseCurrentUser = vi.mocked(useCurrentUser);

describe('OnboardingGuard', () => {
  it('renders loading spinner while loading', () => {
    mockUseCurrentUser.mockReturnValue({
      isLoading: true,
      isError: false,
      data: undefined,
    } as unknown as ReturnType<typeof useCurrentUser>);

    render(
      <MemoryRouter>
        <OnboardingGuard>
          <div>Protected content</div>
        </OnboardingGuard>
      </MemoryRouter>,
    );

    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });

  it('renders children on error (fail open)', () => {
    mockUseCurrentUser.mockReturnValue({
      isLoading: false,
      isError: true,
      data: undefined,
    } as unknown as ReturnType<typeof useCurrentUser>);

    render(
      <MemoryRouter>
        <OnboardingGuard>
          <div>Protected content</div>
        </OnboardingGuard>
      </MemoryRouter>,
    );

    expect(screen.getByText('Protected content')).toBeInTheDocument();
  });

  it('redirects to /onboarding when onboardingCompleted is false', () => {
    mockUseCurrentUser.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { data: { onboardingCompleted: false } },
    } as unknown as ReturnType<typeof useCurrentUser>);

    render(
      <MemoryRouter initialEntries={['/profile']}>
        <OnboardingGuard>
          <div>Protected content</div>
        </OnboardingGuard>
      </MemoryRouter>,
    );

    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });

  it('renders children when onboardingCompleted is true', () => {
    mockUseCurrentUser.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { data: { onboardingCompleted: true } },
    } as unknown as ReturnType<typeof useCurrentUser>);

    render(
      <MemoryRouter>
        <OnboardingGuard>
          <div>Protected content</div>
        </OnboardingGuard>
      </MemoryRouter>,
    );

    expect(screen.getByText('Protected content')).toBeInTheDocument();
  });
});
