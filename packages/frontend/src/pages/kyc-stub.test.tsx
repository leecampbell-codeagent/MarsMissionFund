import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import KycStubPage from './kyc-stub.js';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('KycStubPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the IDENTITY VERIFICATION heading', () => {
    render(
      <MemoryRouter>
        <KycStubPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'IDENTITY VERIFICATION' })).toBeInTheDocument();
  });

  it('renders the stub message', () => {
    render(
      <MemoryRouter>
        <KycStubPage />
      </MemoryRouter>,
    );

    expect(screen.getByText(/KYC verification is not yet available/)).toBeInTheDocument();
  });

  it('renders the Go Back button', () => {
    render(
      <MemoryRouter>
        <KycStubPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: 'Go Back' })).toBeInTheDocument();
  });

  it('calls navigate(-1) when Go Back is clicked', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <KycStubPage />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Go Back' }));

    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });
});
