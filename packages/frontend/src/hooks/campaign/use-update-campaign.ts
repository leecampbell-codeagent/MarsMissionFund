import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateCampaign } from '../../api/campaign-api';
import type { ApiError } from '../../api/client';
import type { Campaign, UpdateCampaignInput } from '../../types/campaign';
import { campaignQueryKey } from './use-campaign';

export interface UseUpdateCampaignResult {
  readonly updateCampaign: (id: string, input: UpdateCampaignInput) => Promise<Campaign>;
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly error: ApiError | null;
}

/**
 * Mutation hook for auto-saving campaign draft changes.
 * On success: updates the ['campaign', id] cache directly.
 */
export function useUpdateCampaign(): UseUpdateCampaignResult {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateCampaignInput }) =>
      updateCampaign(id, input),
    onSuccess: (updatedCampaign) => {
      // Update the campaign cache immediately
      queryClient.setQueryData(campaignQueryKey(updatedCampaign.id), updatedCampaign);
    },
  });

  return {
    updateCampaign: async (id: string, input: UpdateCampaignInput) =>
      mutation.mutateAsync({ id, input }),
    isLoading: mutation.isPending,
    isError: mutation.isError,
    error: mutation.isError ? (mutation.error as ApiError) : null,
  };
}
