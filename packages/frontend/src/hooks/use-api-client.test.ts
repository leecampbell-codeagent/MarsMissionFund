import { renderHook } from '@testing-library/react';
import { vi } from 'vitest';

// Mock @clerk/react
vi.mock('@clerk/react', () => ({
  useAuth: vi.fn(),
}));

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  useNavigate: vi.fn(),
}));

import { useAuth } from '@clerk/react';
import { useNavigate } from 'react-router-dom';
import { useApiClient } from './use-api-client.js';

const mockUseAuth = vi.mocked(useAuth);
const mockUseNavigate = vi.mocked(useNavigate);

describe('useApiClient', () => {
  const mockNavigate = vi.fn();
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    mockUseNavigate.mockReturnValue(mockNavigate);
    global.fetch = mockFetch;
  });

  it('injects Authorization: Bearer header when getToken() returns a token', async () => {
    const mockGetToken = vi.fn().mockResolvedValue('test-jwt-token');
    mockUseAuth.mockReturnValue({
      getToken: mockGetToken,
      isSignedIn: true,
    } as unknown as ReturnType<typeof useAuth>);

    mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

    const { result } = renderHook(() => useApiClient());

    await result.current.fetchWithAuth('/api/v1/me');

    expect(mockFetch).toHaveBeenCalledOnce();
    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = options.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer test-jwt-token');
  });

  it('calls getToken() on every request (no caching)', async () => {
    const mockGetToken = vi.fn().mockResolvedValue('fresh-token');
    mockUseAuth.mockReturnValue({
      getToken: mockGetToken,
      isSignedIn: true,
    } as unknown as ReturnType<typeof useAuth>);

    mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

    const { result } = renderHook(() => useApiClient());

    await result.current.fetchWithAuth('/api/v1/me');
    await result.current.fetchWithAuth('/api/v1/me');

    expect(mockGetToken).toHaveBeenCalledTimes(2);
  });

  it('redirects to /sign-in and throws when getToken() returns null', async () => {
    const mockGetToken = vi.fn().mockResolvedValue(null);
    mockUseAuth.mockReturnValue({
      getToken: mockGetToken,
      isSignedIn: false,
    } as unknown as ReturnType<typeof useAuth>);

    const { result } = renderHook(() => useApiClient());

    await expect(result.current.fetchWithAuth('/api/v1/me')).rejects.toThrow('Not authenticated');
    expect(mockNavigate).toHaveBeenCalledWith('/sign-in');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('redirects to /sign-in and throws when getToken() throws', async () => {
    const mockGetToken = vi.fn().mockRejectedValue(new Error('Session expired'));
    mockUseAuth.mockReturnValue({
      getToken: mockGetToken,
      isSignedIn: true,
    } as unknown as ReturnType<typeof useAuth>);

    const { result } = renderHook(() => useApiClient());

    await expect(result.current.fetchWithAuth('/api/v1/me')).rejects.toThrow('Session expired');
    expect(mockNavigate).toHaveBeenCalledWith('/sign-in');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('redirects to /sign-in and throws when response status is 401', async () => {
    const mockGetToken = vi.fn().mockResolvedValue('valid-token');
    mockUseAuth.mockReturnValue({
      getToken: mockGetToken,
      isSignedIn: true,
    } as unknown as ReturnType<typeof useAuth>);

    mockFetch.mockResolvedValue(new Response('{"error":"Unauthorized"}', { status: 401 }));

    const { result } = renderHook(() => useApiClient());

    await expect(result.current.fetchWithAuth('/api/v1/me')).rejects.toThrow('Unauthorized');
    expect(mockNavigate).toHaveBeenCalledWith('/sign-in');
  });

  it('includes X-Request-Id header on every request', async () => {
    const mockGetToken = vi.fn().mockResolvedValue('test-token');
    mockUseAuth.mockReturnValue({
      getToken: mockGetToken,
      isSignedIn: true,
    } as unknown as ReturnType<typeof useAuth>);

    mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));

    const { result } = renderHook(() => useApiClient());

    await result.current.fetchWithAuth('/api/v1/me');

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = options.headers as Record<string, string>;
    expect(headers['X-Request-Id']).toBeDefined();
    expect(typeof headers['X-Request-Id']).toBe('string');
  });
});
