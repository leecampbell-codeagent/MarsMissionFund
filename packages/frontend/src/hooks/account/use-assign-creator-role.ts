import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UserProfile } from '../../api/account-api';
import { assignCreatorRole } from '../../api/campaign-api';
import type { ApiError } from '../../api/client';
import { CURRENT_USER_QUERY_KEY } from './use-current-user';

export interface UseAssignCreatorRoleResult {
  readonly assignCreatorRole: () => Promise<UserProfile>;
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly error: ApiError | null;
}

/**
 * Mutation hook to assign the creator role to the current user.
 * On success: updates ['me'] cache and invalidates to trigger refetch.
 */
export function useAssignCreatorRole(): UseAssignCreatorRoleResult {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: assignCreatorRole,
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(CURRENT_USER_QUERY_KEY, updatedUser);
      void queryClient.invalidateQueries({ queryKey: CURRENT_USER_QUERY_KEY });
    },
  });

  return {
    assignCreatorRole: async () => mutation.mutateAsync(),
    isLoading: mutation.isPending,
    isError: mutation.isError,
    error: mutation.isError ? (mutation.error as ApiError) : null,
  };
}
