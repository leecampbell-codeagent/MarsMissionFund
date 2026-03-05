import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import VerificationSettingsPage from './settings-verification';

const mockGetToken = vi.fn().mockResolvedValue('mock-token');
vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ getToken: mockGetToken, isLoaded: true }),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

function makeKycResponse(status: string, overrides: Record<string, unknown> = {}) {
  return {
    data: {
      id: 'kyc-test-001',
      accountId: 'acc-test-001',
      status,
      documentType: null,
      failureCount: 0,
      verifiedAt: null,
      submittedAt: null,
      ...overrides,
    },
  };
}

function renderWithProviders() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <VerificationSettingsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('VerificationSettingsPage', () => {
  it('renders loading skeleton initially', () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    renderWithProviders();
    expect(document.querySelector('.settings-page')).toBeInTheDocument();
  });

  it('renders heading when loaded', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => makeKycResponse('not_verified'),
    });

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText('IDENTITY VERIFICATION')).toBeInTheDocument();
    });
  });

  it('shows NOT VERIFIED badge for not_verified status', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => makeKycResponse('not_verified'),
    });

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByRole('status', { name: /kyc status/i })).toBeInTheDocument();
      expect(screen.getByRole('status', { name: /not verified/i })).toBeInTheDocument();
    });
  });

  it('shows VERIFIED badge for verified status', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () =>
        makeKycResponse('verified', {
          documentType: 'passport',
          verifiedAt: '2026-03-05T10:00:00Z',
        }),
    });

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByRole('status', { name: /verified/i })).toBeInTheDocument();
    });
  });

  it('shows PENDING badge and polling indicator for pending status', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => makeKycResponse('pending'),
    });

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByRole('status', { name: /pending/i })).toBeInTheDocument();
      expect(screen.getByText(/checking status/i)).toBeInTheDocument();
    });
  });

  it('shows LOCKED badge for locked status', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => makeKycResponse('locked', { failureCount: 5 }),
    });

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByRole('status', { name: /locked/i })).toBeInTheDocument();
    });
  });

  it('shows RESUBMISSION REQUIRED badge for pending_resubmission status', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => makeKycResponse('pending_resubmission', { failureCount: 2 }),
    });

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByRole('status', { name: /resubmission required/i })).toBeInTheDocument();
      expect(screen.getByText(/failed attempts: 2 \/ 5/i)).toBeInTheDocument();
    });
  });

  it('shows submit form for not_verified status', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => makeKycResponse('not_verified'),
    });

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: /document type/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /submit for verification/i })).toBeInTheDocument();
    });
  });

  it('shows resubmit form for pending_resubmission status', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => makeKycResponse('pending_resubmission'),
    });

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText(/resubmit documents/i)).toBeInTheDocument();
    });
  });

  it('does NOT show submit form for verified status', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () =>
        makeKycResponse('verified', { verifiedAt: '2026-03-05T10:00:00Z' }),
    });

    renderWithProviders();

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /submit/i })).not.toBeInTheDocument();
    });
  });

  it('does NOT show submit form for pending status', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => makeKycResponse('pending'),
    });

    renderWithProviders();

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /submit/i })).not.toBeInTheDocument();
    });
  });

  it('does NOT show submit form for locked status', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => makeKycResponse('locked', { failureCount: 5 }),
    });

    renderWithProviders();

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /submit/i })).not.toBeInTheDocument();
    });
  });

  it('shows verified date when verified', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () =>
        makeKycResponse('verified', { verifiedAt: '2026-03-05T10:00:00Z' }),
    });

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText(/verified:/i)).toBeInTheDocument();
    });
  });

  it('submits form and calls API', async () => {
    const user = userEvent.setup();

    // First call: status fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => makeKycResponse('not_verified'),
    });
    // Second call: submit mutation
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => makeKycResponse('verified'),
    });
    // Third call: re-fetch after invalidation
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => makeKycResponse('verified'),
    });

    renderWithProviders();

    const submitButton = await screen.findByRole('button', { name: /submit for verification/i });
    await user.click(submitButton);

    await waitFor(() => {
      const calls = mockFetch.mock.calls;
      const submitCall = calls.find(
        (c) => typeof c[0] === 'string' && (c[0] as string).includes('/api/v1/kyc/submit'),
      );
      expect(submitCall).toBeDefined();
    });
  });

  it('shows error message on submit failure', async () => {
    const user = userEvent.setup();

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => makeKycResponse('not_verified'),
    });
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: { code: 'SERVER_ERROR', message: 'Internal error.' } }),
    });

    renderWithProviders();

    const submitButton = await screen.findByRole('button', { name: /submit for verification/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/verification submission failed/i)).toBeInTheDocument();
    });
  });
});

// ─── KycStatusBadge tests ─────────────────────────────────────────────────────

describe('KycStatusBadge (via page)', () => {
  const statusesToTest: Array<{ status: string; expectedLabel: string }> = [
    { status: 'not_verified', expectedLabel: 'NOT VERIFIED' },
    { status: 'pending', expectedLabel: 'PENDING' },
    { status: 'pending_resubmission', expectedLabel: 'RESUBMISSION REQUIRED' },
    { status: 'in_manual_review', expectedLabel: 'IN MANUAL REVIEW' },
    { status: 'verified', expectedLabel: 'VERIFIED' },
    { status: 'rejected', expectedLabel: 'REJECTED' },
    { status: 'locked', expectedLabel: 'LOCKED' },
    { status: 'expired', expectedLabel: 'EXPIRED' },
    { status: 'reverification_required', expectedLabel: 'REVERIFICATION REQUIRED' },
  ];

  for (const { status, expectedLabel } of statusesToTest) {
    it(`renders ${expectedLabel} badge for ${status} status`, async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => makeKycResponse(status),
      });

      renderWithProviders();

      await waitFor(() => {
        expect(
          screen.getByRole('status', { name: new RegExp(expectedLabel, 'i') }),
        ).toBeInTheDocument();
      });
    });
  }
});
