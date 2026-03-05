import { useMutation, useQueryClient } from '@tanstack/react-query';
import { submitCampaign } from '../../api/campaign-api';
import type { ApiError } from '../../api/client';
import type { Campaign } from '../../types/campaign';
import { campaignQueryKey } from './use-campaign';
import { MY_CAMPAIGNS_QUERY_KEY } from './use-my-campaigns';

export interface UseSubmitCampaignResult {
  readonly submitCampaign: (id: string) => Promise<Campaign>;
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly error: ApiError | null;
}

/**
 * Mutation hook to submit a campaign draft for review.
 * On success: updates campaign cache and invalidates myCampaigns.
 */
export function useSubmitCampaign(): UseSubmitCampaignResult {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (id: string) => submitCampaign(id),
    onSuccess: (updatedCampaign) => {
      queryClient.setQueryData(campaignQueryKey(updatedCampaign.id), updatedCampaign);
      void queryClient.invalidateQueries({ queryKey: MY_CAMPAIGNS_QUERY_KEY });
    },
  });

  return {
    submitCampaign: async (id: string) => mutation.mutateAsync(id),
    isLoading: mutation.isPending,
    isError: mutation.isError,
    error: mutation.isError ? (mutation.error as ApiError) : null,
  };
}
