import { useQuery } from '@tanstack/react-query';
import type { KycApiResponse, KycStatus } from '../../api/kyc-api';
import { useApiClient } from '../use-api-client';

const POLLING_STATUSES: readonly KycStatus[] = ['pending'];

export function useKycStatus() {
  const apiClient = useApiClient();

  return useQuery({
    queryKey: ['kyc', 'status'],
    queryFn: () => apiClient.get<KycApiResponse>('/api/v1/kyc/status').then((r) => r.data),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status && POLLING_STATUSES.includes(status)) {
        return 3000; // Poll every 3 seconds while pending
      }
      return false;
    },
  });
}
