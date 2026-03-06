import { useApiClient } from '../hooks/use-api-client.js';

export function useTypedApiClient() {
  const { fetchWithAuth } = useApiClient();

  async function get<T>(path: string): Promise<T> {
    const res = await fetchWithAuth(path);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(
        (body as { error?: { message?: string } }).error?.message ?? `HTTP ${res.status}`,
      );
    }
    return res.json() as Promise<T>;
  }

  async function put<T>(path: string, body: unknown): Promise<T> {
    const res = await fetchWithAuth(path, { method: 'PUT', body: JSON.stringify(body) });
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      throw new Error(
        (b as { error?: { message?: string } }).error?.message ?? `HTTP ${res.status}`,
      );
    }
    return res.json() as Promise<T>;
  }

  async function post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetchWithAuth(path, { method: 'POST', body: JSON.stringify(body) });
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      throw new Error(
        (b as { error?: { message?: string } }).error?.message ?? `HTTP ${res.status}`,
      );
    }
    return res.json() as Promise<T>;
  }

  async function patch<T>(path: string, body: unknown): Promise<T> {
    const res = await fetchWithAuth(path, { method: 'PATCH', body: JSON.stringify(body) });
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      throw new Error(
        (b as { error?: { message?: string } }).error?.message ?? `HTTP ${res.status}`,
      );
    }
    return res.json() as Promise<T>;
  }

  return { get, put, post, patch };
}
