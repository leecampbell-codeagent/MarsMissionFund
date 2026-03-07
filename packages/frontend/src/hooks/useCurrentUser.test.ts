import { useAuth } from '@clerk/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCurrentUser } from './useCurrentUser';

vi.mock('@clerk/react', () => ({
  useAuth: vi.fn(),
}));

const mockUseAuth = vi.mocked(useAuth);

const server = setupServer();

beforeEach(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  server.close();
});

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

const mockUserProfile = {
  id: '7b3e9f1c-8a2d-4e5b-9c6f-1d2e3f4a5b6c',
  email: 'test@example.com',
  displayName: 'Test User',
  avatarUrl: null,
  bio: null,
  roles: ['backer'],
  kycStatus: 'not_verified',
  onboardingCompleted: false,
};

describe('useCurrentUser', () => {
  it('does not fetch when user is not signed in', () => {
    mockUseAuth.mockReturnValue({
      isSignedIn: false,
      getToken: vi.fn().mockResolvedValue(null),
    } as unknown as ReturnType<typeof useAuth>);

    const { result } = renderHook(() => useCurrentUser(), {
      wrapper: makeWrapper(),
    });

    expect(result.current.status).toBe('pending');
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('fetches user data when signed in', async () => {
    mockUseAuth.mockReturnValue({
      isSignedIn: true,
      getToken: vi.fn().mockResolvedValue('mock-token'),
    } as unknown as ReturnType<typeof useAuth>);

    server.use(
      http.get('http://localhost:3001/v1/me', () => {
        return HttpResponse.json(mockUserProfile);
      }),
    );

    const { result } = renderHook(() => useCurrentUser(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockUserProfile);
  });

  it('returns error state on API failure', async () => {
    mockUseAuth.mockReturnValue({
      isSignedIn: true,
      getToken: vi.fn().mockResolvedValue('mock-token'),
    } as unknown as ReturnType<typeof useAuth>);

    server.use(
      http.get('http://localhost:3001/v1/me', () => {
        return HttpResponse.json(
          { error: { code: 'INTERNAL_SERVER_ERROR', message: 'Server error' } },
          { status: 500 },
        );
      }),
    );

    const { result } = renderHook(() => useCurrentUser(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeDefined();
  });
});
