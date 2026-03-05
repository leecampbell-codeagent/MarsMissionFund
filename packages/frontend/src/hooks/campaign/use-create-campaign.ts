import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createCampaign } from '../../api/campaign-api';
import type { ApiError } from '../../api/client';
import type { Campaign } from '../../types/campaign';
import { MY_CAMPAIGNS_QUERY_KEY } from './use-my-campaigns';

export interface UseCreateCampaignResult {
  readonly createCampaign: (title: string) => Promise<Campaign>;
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly error: ApiError | null;
}

/**
 * Mutation hook to create a new campaign draft.
 * On success: invalidates myCampaigns query.
 */
export function useCreateCampaign(): UseCreateCampaignResult {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (title: string) => createCampaign({ title }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: MY_CAMPAIGNS_QUERY_KEY });
    },
  });

  return {
    createCampaign: async (title: string) => mutation.mutateAsync(title),
    isLoading: mutation.isPending,
    isError: mutation.isError,
    error: mutation.isError ? (mutation.error as ApiError) : null,
  };
}
