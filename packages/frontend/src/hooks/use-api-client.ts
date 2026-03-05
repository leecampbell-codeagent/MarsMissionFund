import { useAuth } from '@clerk/clerk-react';
import { useMemo } from 'react';
import { createApiClient } from '../lib/api-client';

/**
 * Hook that returns an API client with automatic Bearer token injection.
 * Uses Clerk's useAuth().getToken() for token retrieval.
 */
export function useApiClient() {
  const { getToken } = useAuth();
  return useMemo(() => createApiClient(getToken), [getToken]);
}
