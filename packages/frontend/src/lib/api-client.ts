/**
 * Centralised API client with automatic Bearer token injection.
 * Uses native fetch — no Axios.
 */

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class UnauthenticatedError extends ApiError {
  constructor(message: string = 'Authentication required.') {
    super(401, 'UNAUTHENTICATED', message);
    this.name = 'UnauthenticatedError';
  }
}

interface ApiClientRequestOptions {
  readonly method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  readonly path: string;
  readonly body?: unknown;
  readonly params?: Record<string, string>;
}

interface ApiClient {
  readonly get: <T>(path: string, params?: Record<string, string>) => Promise<T>;
  readonly post: <T>(path: string, body?: unknown) => Promise<T>;
  readonly put: <T>(path: string, body?: unknown) => Promise<T>;
  readonly del: <T>(path: string) => Promise<T>;
}

async function makeRequest<T>(
  getToken: () => Promise<string | null>,
  { method, path, body, params }: ApiClientRequestOptions,
): Promise<T> {
  const baseUrl = import.meta.env.VITE_API_URL ?? '';
  const url = new URL(path, baseUrl || window.location.origin);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }

  const token = await getToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url.toString(), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401) {
    const errorBody = await response.json().catch(() => ({
      error: { code: 'UNAUTHENTICATED', message: 'Authentication required.' },
    }));
    throw new UnauthenticatedError(errorBody.error?.message ?? 'Authentication required.');
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({
      error: { code: 'UNKNOWN_ERROR', message: 'An unexpected error occurred.' },
    }));
    throw new ApiError(
      response.status,
      errorBody.error?.code ?? 'UNKNOWN_ERROR',
      errorBody.error?.message ?? 'An unexpected error occurred.',
    );
  }

  return response.json() as Promise<T>;
}

/**
 * Creates a typed API client that injects the Bearer token from Clerk.
 */
export function createApiClient(getToken: () => Promise<string | null>): ApiClient {
  return {
    get: <T>(path: string, params?: Record<string, string>) =>
      makeRequest<T>(getToken, { method: 'GET', path, params }),
    post: <T>(path: string, body?: unknown) =>
      makeRequest<T>(getToken, { method: 'POST', path, body }),
    put: <T>(path: string, body?: unknown) =>
      makeRequest<T>(getToken, { method: 'PUT', path, body }),
    del: <T>(path: string) =>
      makeRequest<T>(getToken, { method: 'DELETE', path }),
  };
}
