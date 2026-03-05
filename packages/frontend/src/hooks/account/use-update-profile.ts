import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type Account, type UpdateProfileInput } from '../../api/account-api';
import { useApiClient } from '../use-api-client';

export function useUpdateProfile() {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateProfileInput) =>
      apiClient.patch<Account>('/api/v1/accounts/me', input),
    onSuccess: (data) => {
      queryClient.setQueryData(['account', 'me'], data);
    },
  });
}
