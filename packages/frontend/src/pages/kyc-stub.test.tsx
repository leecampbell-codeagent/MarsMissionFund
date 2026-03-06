import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

vi.mock('../hooks/use-kyc-status.js', () => ({
  useKycStatus: vi.fn(),
}));
vi.mock('../hooks/use-submit-kyc.js', () => ({
  useSubmitKyc: vi.fn(),
}));

import { useKycStatus } from '../hooks/use-kyc-status.js';
import { useSubmitKyc } from '../hooks/use-submit-kyc.js';
import KycStubPage from './kyc-stub.js';

const mockUseKycStatus = vi.mocked(useKycStatus);
const mockUseSubmitKyc = vi.mocked(useSubmitKyc);

const mockSubmitKyc = vi.fn();

describe('KycStubPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseKycStatus.mockReturnValue({
      data: undefined,
      isLoading: true,
    } as unknown as ReturnType<typeof useKycStatus>);
    mockUseSubmitKyc.mockReturnValue({
      mutate: mockSubmitKyc,
      isPending: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useSubmitKyc>);
  });

  it('renders loading spinner when useKycStatus is loading', () => {
    render(
      <MemoryRouter>
        <KycStubPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('status', { name: 'Loading verification status' })).toBeInTheDocument();
  });

  it('renders "IDENTITY VERIFICATION" heading in all non-loading states', () => {
    mockUseKycStatus.mockReturnValue({
      data: { data: { status: 'not_verified', verifiedAt: null } },
      isLoading: false,
    } as unknown as ReturnType<typeof useKycStatus>);

    render(
      <MemoryRouter>
        <KycStubPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'IDENTITY VERIFICATION' })).toBeInTheDocument();
  });

  it('renders document type selector and submit button when status is "not_verified"', () => {
    mockUseKycStatus.mockReturnValue({
      data: { data: { status: 'not_verified', verifiedAt: null } },
      isLoading: false,
    } as unknown as ReturnType<typeof useKycStatus>);

    render(
      <MemoryRouter>
        <KycStubPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('combobox', { name: 'Document Type' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'SUBMIT FOR VERIFICATION' })).toBeInTheDocument();
  });

  it('renders document type selector and submit button when status is "pending"', () => {
    mockUseKycStatus.mockReturnValue({
      data: { data: { status: 'pending', verifiedAt: null } },
      isLoading: false,
    } as unknown as ReturnType<typeof useKycStatus>);

    render(
      <MemoryRouter>
        <KycStubPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('combobox', { name: 'Document Type' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'SUBMIT FOR VERIFICATION' })).toBeInTheDocument();
  });

  it('renders "VERIFICATION APPROVED" and "Return to Profile" link when status is "verified"', () => {
    mockUseKycStatus.mockReturnValue({
      data: { data: { status: 'verified', verifiedAt: '2026-03-06T00:00:00Z' } },
      isLoading: false,
    } as unknown as ReturnType<typeof useKycStatus>);

    render(
      <MemoryRouter>
        <KycStubPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'VERIFICATION APPROVED' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Return to Profile' })).toBeInTheDocument();
  });

  it('submit button calls submitKyc mutation with selected documentType', async () => {
    const user = userEvent.setup();
    mockUseKycStatus.mockReturnValue({
      data: { data: { status: 'not_verified', verifiedAt: null } },
      isLoading: false,
    } as unknown as ReturnType<typeof useKycStatus>);

    render(
      <MemoryRouter>
        <KycStubPage />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'SUBMIT FOR VERIFICATION' }));

    expect(mockSubmitKyc).toHaveBeenCalledWith({ documentType: 'passport' });
  });

  it('shows error message when mutation isError is true', () => {
    mockUseKycStatus.mockReturnValue({
      data: { data: { status: 'not_verified', verifiedAt: null } },
      isLoading: false,
    } as unknown as ReturnType<typeof useKycStatus>);
    mockUseSubmitKyc.mockReturnValue({
      mutate: mockSubmitKyc,
      isPending: false,
      isError: true,
      error: new Error('Submission failed'),
    } as unknown as ReturnType<typeof useSubmitKyc>);

    render(
      <MemoryRouter>
        <KycStubPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Submission failed');
  });

  it('submit button shows LoadingSpinner (with label="Submitting") when isPending is true', () => {
    mockUseKycStatus.mockReturnValue({
      data: { data: { status: 'not_verified', verifiedAt: null } },
      isLoading: false,
    } as unknown as ReturnType<typeof useKycStatus>);
    mockUseSubmitKyc.mockReturnValue({
      mutate: mockSubmitKyc,
      isPending: true,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useSubmitKyc>);

    render(
      <MemoryRouter>
        <KycStubPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('status', { name: 'Submitting' })).toBeInTheDocument();
  });

  it('submit button is disabled when isPending is true', () => {
    mockUseKycStatus.mockReturnValue({
      data: { data: { status: 'not_verified', verifiedAt: null } },
      isLoading: false,
    } as unknown as ReturnType<typeof useKycStatus>);
    mockUseSubmitKyc.mockReturnValue({
      mutate: mockSubmitKyc,
      isPending: true,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useSubmitKyc>);

    render(
      <MemoryRouter>
        <KycStubPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { hidden: true })).toBeDisabled();
  });

  it('document type select defaults to "passport"', () => {
    mockUseKycStatus.mockReturnValue({
      data: { data: { status: 'not_verified', verifiedAt: null } },
      isLoading: false,
    } as unknown as ReturnType<typeof useKycStatus>);

    render(
      <MemoryRouter>
        <KycStubPage />
      </MemoryRouter>,
    );

    const select = screen.getByRole('combobox', { name: 'Document Type' }) as HTMLSelectElement;
    expect(select.value).toBe('passport');
  });

  it('document type select can be changed (e.g. to "national_id")', async () => {
    const user = userEvent.setup();
    mockUseKycStatus.mockReturnValue({
      data: { data: { status: 'not_verified', verifiedAt: null } },
      isLoading: false,
    } as unknown as ReturnType<typeof useKycStatus>);

    render(
      <MemoryRouter>
        <KycStubPage />
      </MemoryRouter>,
    );

    const select = screen.getByRole('combobox', { name: 'Document Type' }) as HTMLSelectElement;
    await user.selectOptions(select, 'national_id');
    expect(select.value).toBe('national_id');
  });
});
