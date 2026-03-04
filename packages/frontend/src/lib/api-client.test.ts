import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createApiClient, UnauthenticatedError, ApiError } from './api-client';

describe('createApiClient', () => {
  const mockGetToken = vi.fn<() => Promise<string | null>>();

  beforeEach(() => {
    vi.restoreAllMocks();
    mockGetToken.mockResolvedValue('test-token-abc123');
  });

  it('includes Bearer token in requests', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: 'test' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const client = createApiClient(mockGetToken);
    await client.get('/api/v1/auth/me');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token-abc123',
        }),
      }),
    );
  });

  it('throws UnauthenticatedError on 401 response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: () =>
        Promise.resolve({
          error: { code: 'UNAUTHENTICATED', message: 'Authentication required.' },
        }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const client = createApiClient(mockGetToken);
    await expect(client.get('/api/v1/auth/me')).rejects.toThrow(UnauthenticatedError);
  });

  it('throws ApiError on non-401 error responses', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: () =>
        Promise.resolve({
          error: { code: 'ACCOUNT_SUSPENDED', message: 'Your account has been suspended.' },
        }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const client = createApiClient(mockGetToken);
    await expect(client.get('/api/v1/auth/me')).rejects.toThrow(ApiError);
  });

  it('sends POST request with JSON body', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: 'created' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const client = createApiClient(mockGetToken);
    await client.post('/api/v1/resource', { name: 'test' });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'test' }),
      }),
    );
  });

  it('does not include Authorization header when token is null', async () => {
    mockGetToken.mockResolvedValue(null);
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: 'test' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const client = createApiClient(mockGetToken);
    await client.get('/api/v1/public');

    const callArgs = mockFetch.mock.calls[0] as [string, RequestInit];
    const calledHeaders = callArgs[1].headers as Record<string, string>;
    expect(calledHeaders).not.toHaveProperty('Authorization');
  });
});
