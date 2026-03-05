import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Account, AdvanceOnboardingInput } from '../../api/account-api';
import { useApiClient } from '../use-api-client';

export function useAdvanceOnboarding() {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: AdvanceOnboardingInput) =>
      apiClient.patch<Account>('/api/v1/accounts/me/onboarding', input),
    onSuccess: (data) => {
      queryClient.setQueryData(['account', 'me'], data);
    },
  });
}
