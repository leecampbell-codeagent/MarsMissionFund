import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTypedApiClient } from '../lib/api-client.js';
import type { KycSubmitResponse } from '../types/kyc.js';

interface SubmitKycInput {
  readonly documentType: 'passport' | 'national_id' | 'drivers_licence';
}

export function useSubmitKyc() {
  const client = useTypedApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SubmitKycInput) =>
      client.post<KycSubmitResponse>('/api/v1/kyc/submit', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['kyc-status'] });
    },
  });
}
