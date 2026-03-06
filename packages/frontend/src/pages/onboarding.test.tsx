import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import OnboardingPage from './onboarding.js';

// Mock hooks
vi.mock('../hooks/use-current-user.js', () => ({
  useCurrentUser: vi.fn(),
}));

vi.mock('../hooks/use-complete-onboarding.js', () => ({
  useCompleteOnboarding: vi.fn(),
}));

vi.mock('../hooks/use-save-onboarding-step.js', () => ({
  useSaveOnboardingStep: vi.fn(),
}));

vi.mock('@clerk/react', () => ({
  useUser: vi.fn(),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

import { useUser } from '@clerk/react';
import { useCompleteOnboarding } from '../hooks/use-complete-onboarding.js';
import { useCurrentUser } from '../hooks/use-current-user.js';
import { useSaveOnboardingStep } from '../hooks/use-save-onboarding-step.js';

const mockUseCurrentUser = vi.mocked(useCurrentUser);
const mockUseCompleteOnboarding = vi.mocked(useCompleteOnboarding);
const mockUseSaveOnboardingStep = vi.mocked(useSaveOnboardingStep);
const mockUseUser = vi.mocked(useUser);

const mockMutate = vi.fn();
const mockSaveStepMutate = vi.fn();

function setupDefaultMocks() {
  mockUseCurrentUser.mockReturnValue({
    isLoading: false,
    isError: false,
    data: {
      data: {
        onboardingCompleted: false,
        onboardingStep: null,
      },
    },
  } as unknown as ReturnType<typeof useCurrentUser>);

  mockUseCompleteOnboarding.mockReturnValue({
    mutate: mockMutate,
    isPending: false,
    isError: false,
    error: null,
  } as unknown as ReturnType<typeof useCompleteOnboarding>);

  mockUseSaveOnboardingStep.mockReturnValue({
    mutate: mockSaveStepMutate,
    isPending: false,
  } as unknown as ReturnType<typeof useSaveOnboardingStep>);

  mockUseUser.mockReturnValue({
    user: null,
    isLoaded: true,
    isSignedIn: true,
  } as unknown as ReturnType<typeof useUser>);
}

describe('OnboardingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  it('renders loading state', () => {
    mockUseCurrentUser.mockReturnValue({
      isLoading: true,
      isError: false,
      data: undefined,
    } as unknown as ReturnType<typeof useCurrentUser>);

    render(
      <MemoryRouter>
        <OnboardingPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('redirects to /dashboard if onboardingCompleted is true', () => {
    mockUseCurrentUser.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { data: { onboardingCompleted: true, onboardingStep: null } },
    } as unknown as ReturnType<typeof useCurrentUser>);

    render(
      <MemoryRouter initialEntries={['/onboarding']}>
        <OnboardingPage />
      </MemoryRouter>,
    );

    // Navigate component is rendered; no step 1 content
    expect(screen.queryByText('READY FOR LAUNCH')).not.toBeInTheDocument();
  });

  it('renders Step 1 welcome content by default', () => {
    render(
      <MemoryRouter>
        <OnboardingPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'READY FOR LAUNCH' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'BEGIN MISSION SETUP' })).toBeInTheDocument();
    expect(screen.getByText('01 — WELCOME')).toBeInTheDocument();
  });

  it('advances to Step 2 when BEGIN MISSION SETUP is clicked', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <OnboardingPage />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'BEGIN MISSION SETUP' }));

    expect(screen.getByText('02 — YOUR ROLE')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'HOW WILL YOU CONTRIBUTE?' })).toBeInTheDocument();
  });

  it('shows Backer and Creator role options in Step 2', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <OnboardingPage />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'BEGIN MISSION SETUP' }));

    expect(screen.getByRole('button', { name: /Backer/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Creator/i })).toBeInTheDocument();
  });

  it('CONTINUE is disabled when no roles selected', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <OnboardingPage />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'BEGIN MISSION SETUP' }));

    expect(screen.getByRole('button', { name: 'CONTINUE' })).toBeDisabled();
  });

  it('CONTINUE is enabled after selecting a role', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <OnboardingPage />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'BEGIN MISSION SETUP' }));
    await user.click(screen.getByRole('button', { name: /Backer/i }));

    expect(screen.getByRole('button', { name: 'CONTINUE' })).toBeEnabled();
  });

  it('shows KYC modal when Creator role is selected', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <OnboardingPage />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'BEGIN MISSION SETUP' }));
    await user.click(screen.getByRole('button', { name: /Creator/i }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'IDENTITY VERIFICATION REQUIRED' }),
    ).toBeInTheDocument();
  });

  it('closes KYC modal when SKIP FOR NOW is clicked without deselecting Creator', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <OnboardingPage />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'BEGIN MISSION SETUP' }));
    await user.click(screen.getByRole('button', { name: /Creator/i }));
    await user.click(screen.getByRole('button', { name: 'SKIP FOR NOW' }));

    // Modal is gone
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    // Creator still selected (CONTINUE is enabled)
    expect(screen.getByRole('button', { name: 'CONTINUE' })).toBeEnabled();
  });

  it('advances to Step 3 after role selection and CONTINUE', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <OnboardingPage />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'BEGIN MISSION SETUP' }));
    await user.click(screen.getByRole('button', { name: /Backer/i }));
    await user.click(screen.getByRole('button', { name: 'CONTINUE' }));

    expect(screen.getByText('03 — YOUR PROFILE')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'TELL US ABOUT YOURSELF' })).toBeInTheDocument();
  });

  it('calls completeOnboarding when COMPLETE SETUP is clicked', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <OnboardingPage />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'BEGIN MISSION SETUP' }));
    await user.click(screen.getByRole('button', { name: /Backer/i }));
    await user.click(screen.getByRole('button', { name: 'CONTINUE' }));
    await user.click(screen.getByRole('button', { name: 'COMPLETE SETUP' }));

    expect(mockMutate).toHaveBeenCalledOnce();
  });

  it('shows bio character counter in Step 3', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <OnboardingPage />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'BEGIN MISSION SETUP' }));
    await user.click(screen.getByRole('button', { name: /Backer/i }));
    await user.click(screen.getByRole('button', { name: 'CONTINUE' }));

    expect(screen.getByText('0/500')).toBeInTheDocument();
  });

  it('shows error alert when completeOnboarding fails', async () => {
    mockUseCompleteOnboarding.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
      isError: true,
      error: new Error('Server error'),
    } as unknown as ReturnType<typeof useCompleteOnboarding>);

    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <OnboardingPage />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'BEGIN MISSION SETUP' }));
    await user.click(screen.getByRole('button', { name: /Backer/i }));
    await user.click(screen.getByRole('button', { name: 'CONTINUE' }));

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Server error')).toBeInTheDocument();
  });
});
