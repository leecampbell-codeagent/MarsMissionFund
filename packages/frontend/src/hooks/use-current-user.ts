import { useQuery } from '@tanstack/react-query';
import { useTypedApiClient } from '../lib/api-client.js';
import type { MeResponse } from '../types/user.js';

export function useCurrentUser() {
  const client = useTypedApiClient();
  return useQuery({
    queryKey: ['me'],
    queryFn: () => client.get<MeResponse>('/api/v1/me'),
    staleTime: 30_000,
  });
}
