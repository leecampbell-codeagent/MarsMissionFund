import { useQuery } from '@tanstack/react-query';
import type { CampaignApiResponse } from '../../api/campaign-api';
import { useApiClient } from '../use-api-client';

export function useCampaign(id: string | undefined) {
  const apiClient = useApiClient();

  return useQuery({
    queryKey: ['campaigns', id],
    queryFn: () =>
      apiClient.get<CampaignApiResponse>(`/api/v1/campaigns/${id}`).then((r) => r.data),
    enabled: Boolean(id),
  });
}
