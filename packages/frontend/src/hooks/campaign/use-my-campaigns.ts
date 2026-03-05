import { useQuery } from '@tanstack/react-query';
import type { CampaignListApiResponse } from '../../api/campaign-api';
import { useApiClient } from '../use-api-client';

export function useMyCampaigns() {
  const apiClient = useApiClient();

  return useQuery({
    queryKey: ['campaigns', 'mine'],
    queryFn: () =>
      apiClient.get<CampaignListApiResponse>('/api/v1/campaigns/mine').then((r) => r.data),
  });
}
