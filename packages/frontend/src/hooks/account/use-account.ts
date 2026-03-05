import { useQuery } from '@tanstack/react-query';
import { type Account } from '../../api/account-api';
import { useApiClient } from '../use-api-client';

export function useAccount() {
  const apiClient = useApiClient();

  return useQuery({
    queryKey: ['account', 'me'],
    queryFn: () => apiClient.get<Account>('/api/v1/accounts/me'),
  });
}
