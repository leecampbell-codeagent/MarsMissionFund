import { useAuth } from '@clerk/react';
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

export function useApiClient() {
  const { getToken } = useAuth();
  const navigate = useNavigate();

  const fetchWithAuth = useCallback(
    async (path: string, options?: RequestInit): Promise<Response> => {
      let token: string | null = null;
      try {
        token = await getToken();
      } catch {
        navigate('/sign-in');
        throw new Error('Session expired');
      }

      if (!token) {
        navigate('/sign-in');
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${import.meta.env.VITE_API_URL ?? ''}${path}`, {
        ...options,
        headers: {
          ...options?.headers,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Request-Id': crypto.randomUUID(),
        },
      });

      if (response.status === 401) {
        navigate('/sign-in');
        throw new Error('Unauthorized');
      }

      return response;
    },
    [getToken, navigate],
  );

  return { fetchWithAuth };
}
