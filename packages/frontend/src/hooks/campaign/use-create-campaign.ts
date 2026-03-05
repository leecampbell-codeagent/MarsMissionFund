import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CampaignApiResponse, CreateCampaignInput } from '../../api/campaign-api';
import { useApiClient } from '../use-api-client';

export function useCreateCampaign() {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateCampaignInput) =>
      apiClient.post<CampaignApiResponse>('/api/v1/campaigns', input).then((r) => r.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['campaigns', 'mine'] });
    },
  });
}
