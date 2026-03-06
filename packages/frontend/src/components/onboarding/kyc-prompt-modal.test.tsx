import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { KycPromptModal } from './kyc-prompt-modal.js';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('KycPromptModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the heading', () => {
    const onClose = vi.fn();
    render(
      <MemoryRouter>
        <KycPromptModal onClose={onClose} />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('heading', { name: 'IDENTITY VERIFICATION REQUIRED' }),
    ).toBeInTheDocument();
  });

  it('renders the body text', () => {
    const onClose = vi.fn();
    render(
      <MemoryRouter>
        <KycPromptModal onClose={onClose} />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Creator accounts require identity verification/)).toBeInTheDocument();
  });

  it('calls onClose when SKIP FOR NOW is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <MemoryRouter>
        <KycPromptModal onClose={onClose} />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'SKIP FOR NOW' }));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('navigates to /kyc when START KYC NOW is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <MemoryRouter>
        <KycPromptModal onClose={onClose} />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'START KYC NOW' }));

    expect(mockNavigate).toHaveBeenCalledWith('/kyc');
  });

  it('has role="dialog" and aria-modal="true"', () => {
    const onClose = vi.fn();
    render(
      <MemoryRouter>
        <KycPromptModal onClose={onClose} />
      </MemoryRouter>,
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });
});
