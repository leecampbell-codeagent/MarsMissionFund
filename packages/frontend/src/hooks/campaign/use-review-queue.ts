import { useQuery } from '@tanstack/react-query';
import type { CampaignListApiResponse } from '../../api/campaign-api';
import { useApiClient } from '../use-api-client';

export function useReviewQueue() {
  const apiClient = useApiClient();

  return useQuery({
    queryKey: ['campaigns', 'review-queue'],
    queryFn: () =>
      apiClient
        .get<CampaignListApiResponse>('/api/v1/campaigns/review-queue')
        .then((r) => r.data),
  });
}
