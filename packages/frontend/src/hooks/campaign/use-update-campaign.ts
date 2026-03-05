import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CampaignApiResponse, UpdateCampaignInput } from '../../api/campaign-api';
import { useApiClient } from '../use-api-client';

export function useUpdateCampaign() {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateCampaignInput }) =>
      apiClient.patch<CampaignApiResponse>(`/api/v1/campaigns/${id}`, input).then((r) => r.data),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['campaigns', 'mine'] });
      void queryClient.invalidateQueries({ queryKey: ['campaigns', data.id] });
    },
  });
}
