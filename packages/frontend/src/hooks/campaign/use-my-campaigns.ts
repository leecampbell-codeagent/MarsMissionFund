import { useQuery } from '@tanstack/react-query';
import { listMyCampaigns } from '../../api/campaign-api';
import { type CampaignSummary } from '../../types/campaign';
import { type ApiError } from '../../api/client';

export const MY_CAMPAIGNS_QUERY_KEY = ['myCampaigns'] as const;

export interface UseMyCampaignsResult {
  readonly campaigns: CampaignSummary[];
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly error: ApiError | null;
}

/**
 * Hook to fetch the authenticated user's campaigns (creator view).
 * Query key: ['myCampaigns']
 */
export function useMyCampaigns(): UseMyCampaignsResult {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: MY_CAMPAIGNS_QUERY_KEY,
    queryFn: listMyCampaigns,
    staleTime: 30_000,
    retry: 1,
  });

  return {
    campaigns: data ?? [],
    isLoading,
    isError,
    error: isError ? (error as ApiError) : null,
  };
}
