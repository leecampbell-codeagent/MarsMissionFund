import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CampaignApiResponse } from '../../api/campaign-api';
import { useApiClient } from '../use-api-client';

export function useStartReview() {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (campaignId: string) =>
      apiClient
        .post<CampaignApiResponse>(`/api/v1/campaigns/${campaignId}/claim`, {})
        .then((r) => r.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['campaigns', 'review-queue'] });
    },
  });
}
