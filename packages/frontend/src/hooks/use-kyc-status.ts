import { useQuery } from '@tanstack/react-query';
import { useTypedApiClient } from '../lib/api-client.js';
import type { KycStatusResponse } from '../types/kyc.js';

export function useKycStatus() {
  const client = useTypedApiClient();
  return useQuery({
    queryKey: ['kyc-status'],
    queryFn: () => client.get<KycStatusResponse>('/api/v1/kyc/status'),
    staleTime: 30_000,
  });
}
