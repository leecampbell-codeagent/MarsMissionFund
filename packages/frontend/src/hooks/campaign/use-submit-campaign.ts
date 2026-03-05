import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CampaignApiResponse } from '../../api/campaign-api';
import { useApiClient } from '../use-api-client';

export function useSubmitCampaign() {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (campaignId: string) =>
      apiClient
        .post<CampaignApiResponse>(`/api/v1/campaigns/${campaignId}/submit`, {})
        .then((r) => r.data),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['campaigns', 'mine'] });
      void queryClient.invalidateQueries({ queryKey: ['campaigns', data.id] });
    },
  });
}
