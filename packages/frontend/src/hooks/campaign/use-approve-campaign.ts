import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CampaignApiResponse } from '../../api/campaign-api';
import { useApiClient } from '../use-api-client';

export interface ApproveCampaignInput {
  readonly campaignId: string;
  readonly comment?: string;
}

export function useApproveCampaign() {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ campaignId, comment }: ApproveCampaignInput) =>
      apiClient
        .post<CampaignApiResponse>(`/api/v1/campaigns/${campaignId}/approve`, { comment })
        .then((r) => r.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['campaigns', 'review-queue'] });
    },
  });
}
