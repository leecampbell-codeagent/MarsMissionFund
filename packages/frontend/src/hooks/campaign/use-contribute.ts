import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createContribution } from '../../api/contribution-api';
import type { Contribution, CreateContributionInput } from '../../types/contribution';
import { publicCampaignQueryKey } from './use-public-campaign';

export interface UseContributeResult {
  readonly contribute: (input: CreateContributionInput) => void;
  readonly isPending: boolean;
  readonly contribution: Contribution | null;
  readonly error: Error | null;
  readonly reset: () => void;
}

export function useContribute(campaignId?: string): UseContributeResult {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: createContribution,
    onSuccess: () => {
      // Invalidate campaign query so funding totals refresh after a contribution
      if (campaignId) {
        void queryClient.invalidateQueries({ queryKey: publicCampaignQueryKey(campaignId) });
      }
    },
  });

  return {
    contribute: mutation.mutate,
    isPending: mutation.isPending,
    contribution: mutation.data ?? null,
    error: mutation.error,
    reset: mutation.reset,
  };
}
