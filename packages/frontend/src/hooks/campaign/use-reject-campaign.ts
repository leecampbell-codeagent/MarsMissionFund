import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CampaignApiResponse } from '../../api/campaign-api';
import { useApiClient } from '../use-api-client';

export interface RejectCampaignInput {
  readonly campaignId: string;
  readonly comment: string;
}

export function useRejectCampaign() {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ campaignId, comment }: RejectCampaignInput) =>
      apiClient
        .post<CampaignApiResponse>(`/api/v1/campaigns/${campaignId}/reject`, { comment })
        .then((r) => r.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['campaigns', 'review-queue'] });
    },
  });
}
