import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { vi } from 'vitest';

vi.mock('../lib/api-client.js', () => ({
  useTypedApiClient: vi.fn(),
}));

import { useTypedApiClient } from '../lib/api-client.js';
import { useSubmitKyc } from './use-submit-kyc.js';

const mockUseTypedApiClient = vi.mocked(useTypedApiClient);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    queryClient,
    wrapper: function Wrapper({ children }: { children: React.ReactNode }) {
      return React.createElement(QueryClientProvider, { client: queryClient }, children);
    },
  };
}

describe('useSubmitKyc', () => {
  const mockPost = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseTypedApiClient.mockReturnValue({
      get: vi.fn(),
      put: vi.fn(),
      post: mockPost,
      patch: vi.fn(),
    });
  });

  it('calls POST /api/v1/kyc/submit with { documentType }', async () => {
    const mockResponse = { data: { status: 'verified', verifiedAt: '2026-03-06T00:00:00Z' } };
    mockPost.mockResolvedValue(mockResponse);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useSubmitKyc(), { wrapper });

    await act(async () => {
      result.current.mutate({ documentType: 'passport' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockPost).toHaveBeenCalledWith('/api/v1/kyc/submit', { documentType: 'passport' });
  });

  it("invalidates ['kyc-status'] query on success", async () => {
    const mockResponse = { data: { status: 'verified', verifiedAt: '2026-03-06T00:00:00Z' } };
    mockPost.mockResolvedValue(mockResponse);

    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useSubmitKyc(), { wrapper });

    await act(async () => {
      result.current.mutate({ documentType: 'national_id' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['kyc-status'] });
  });
});
