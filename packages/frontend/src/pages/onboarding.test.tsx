import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import OnboardingPlaceholder from './onboarding';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('OnboardingPlaceholder', () => {
  it('renders the onboarding heading', () => {
    render(
      <MemoryRouter>
        <OnboardingPlaceholder />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('ONBOARDING');
  });

  it('renders the placeholder body text', () => {
    render(
      <MemoryRouter>
        <OnboardingPlaceholder />
      </MemoryRouter>,
    );
    expect(
      screen.getByText("Onboarding coming soon. We're building your mission profile."),
    ).toBeInTheDocument();
  });

  it('renders the Skip for now button', () => {
    render(
      <MemoryRouter>
        <OnboardingPlaceholder />
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: 'Skip for now' })).toBeInTheDocument();
  });

  it('navigates to /dashboard when Skip for now is clicked', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <OnboardingPlaceholder />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Skip for now' }));
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });
});
