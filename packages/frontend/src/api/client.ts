/**
 * Centralised API client with JWT injection.
 * All API calls go through this module — never use fetch directly in components.
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

type GetToken = () => Promise<string | null>;

let tokenGetter: GetToken | null = null;

/**
 * Initialise the API client with a token getter function from Clerk.
 * Call this once in main.tsx after ClerkProvider is mounted.
 */
export function initApiClient(getToken: GetToken): void {
  tokenGetter = getToken;
}

export interface RequestOptions {
  readonly method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  readonly path: string;
  readonly body?: unknown;
  readonly params?: Record<string, string>;
}

/**
 * Make an authenticated API request.
 * Prepends /api/v1 to the path.
 * Attaches Authorization: Bearer <token> on every request.
 * Retries once on 401 after refreshing the token.
 */
export async function apiClient<T>(options: RequestOptions): Promise<T> {
  return makeRequest<T>(options, false);
}

async function makeRequest<T>(options: RequestOptions, isRetry: boolean): Promise<T> {
  const { method, path, body, params } = options;

  const url = new URL(`/api/v1${path}`, window.location.origin);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (tokenGetter) {
    try {
      const token = await tokenGetter();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      // Token retrieval failed — proceed without auth (server will return 401)
    }
  }

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Check your connection.');
  }

  if (response.status === 401 && !isRetry) {
    // Retry once after token refresh
    return makeRequest<T>(options, true);
  }

  if (!response.ok) {
    let errorBody: { error?: { code?: string; message?: string } } = {};
    try {
      errorBody = await response.json();
    } catch {
      // Non-JSON response
    }
    throw new ApiError(
      response.status,
      errorBody.error?.code ?? 'UNKNOWN_ERROR',
      errorBody.error?.message ?? 'An unexpected error occurred.',
    );
  }

  const contentType = response.headers.get('content-type');
  if (!contentType?.includes('application/json')) {
    throw new ApiError(response.status, 'INVALID_RESPONSE', 'Expected JSON response from server.');
  }

  return response.json() as Promise<T>;
}
