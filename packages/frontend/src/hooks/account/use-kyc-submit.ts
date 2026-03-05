import { useMutation, useQueryClient } from '@tanstack/react-query';
import { submitKyc } from '../../api/kyc-api';
import { type ApiError } from '../../api/client';
import { CURRENT_USER_QUERY_KEY } from './use-current-user';
import { KYC_STATUS_QUERY_KEY } from './use-kyc-status';

export interface UseKycSubmitResult {
  readonly submitKyc: () => Promise<void>;
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly error: ApiError | null;
}

/**
 * Mutation hook to submit or resubmit KYC verification.
 * On success:
 *   1. Updates ['me'] query cache directly with the returned user profile
 *   2. Invalidates ['me'] query to trigger a refetch
 *   3. Invalidates ['kyc', 'status'] query
 */
export function useKycSubmit(): UseKycSubmitResult {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: submitKyc,
    onSuccess: (updatedUser) => {
      // Immediately update the ['me'] cache to avoid stale data (EC-011, EC-017)
      queryClient.setQueryData(CURRENT_USER_QUERY_KEY, updatedUser);
      // Invalidate both queries so they refetch in the background
      void queryClient.invalidateQueries({ queryKey: CURRENT_USER_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: KYC_STATUS_QUERY_KEY });
    },
  });

  return {
    submitKyc: async () => {
      await mutation.mutateAsync();
    },
    isLoading: mutation.isPending,
    isError: mutation.isError,
    error: mutation.isError ? (mutation.error as ApiError) : null,
  };
}
