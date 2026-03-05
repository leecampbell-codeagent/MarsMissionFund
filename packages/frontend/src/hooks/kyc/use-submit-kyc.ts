import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { KycApiResponse, SubmitKycInput } from '../../api/kyc-api';
import { useApiClient } from '../use-api-client';

export function useSubmitKyc() {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SubmitKycInput) =>
      apiClient.post<KycApiResponse>('/api/v1/kyc/submit', input).then((r) => r.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['kyc', 'status'] });
    },
  });
}
