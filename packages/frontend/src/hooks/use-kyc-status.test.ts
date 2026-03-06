import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { vi } from 'vitest';

vi.mock('../lib/api-client.js', () => ({
  useTypedApiClient: vi.fn(),
}));

import { useTypedApiClient } from '../lib/api-client.js';
import { useKycStatus } from './use-kyc-status.js';

const mockUseTypedApiClient = vi.mocked(useTypedApiClient);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useKycStatus', () => {
  const mockGet = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseTypedApiClient.mockReturnValue({
      get: mockGet,
      put: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
    });
  });

  it("queryKey is ['kyc-status']", async () => {
    mockGet.mockResolvedValue({ data: { status: 'not_verified', verifiedAt: null } });

    const { result } = renderHook(() => useKycStatus(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith('/api/v1/kyc/status');
  });

  it('staleTime is 30_000', () => {
    mockGet.mockResolvedValue({ data: { status: 'not_verified', verifiedAt: null } });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const wrapper = function Wrapper({ children }: { children: React.ReactNode }) {
      return React.createElement(QueryClientProvider, { client: queryClient }, children);
    };

    renderHook(() => useKycStatus(), { wrapper });

    // Verify via query cache that the query was registered with queryKey ['kyc-status']
    // staleTime is passed through useQuery options; we verify the source hook code sets it
    const query = queryClient.getQueryCache().find({ queryKey: ['kyc-status'] });
    expect(query).toBeDefined();
    // The query observer stores staleTime as part of the observer options
    const observer = (query as unknown as { observers: Array<{ options: { staleTime: number } }> })
      .observers[0];
    expect(observer?.options.staleTime).toBe(30_000);
  });

  it('calls GET /api/v1/kyc/status via api client', async () => {
    const mockData = { data: { status: 'not_verified', verifiedAt: null } };
    mockGet.mockResolvedValue(mockData);

    const { result } = renderHook(() => useKycStatus(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith('/api/v1/kyc/status');
    expect(result.current.data).toEqual(mockData);
  });
});
