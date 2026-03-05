import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type Account, type UpdatePreferencesInput } from '../../api/account-api';
import { useApiClient } from '../use-api-client';

export function useUpdatePreferences() {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdatePreferencesInput) =>
      apiClient.patch<Account>('/api/v1/accounts/me/preferences', input),
    onSuccess: (data) => {
      queryClient.setQueryData(['account', 'me'], data);
    },
  });
}
