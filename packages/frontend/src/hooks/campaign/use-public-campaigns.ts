import { useQuery } from '@tanstack/react-query';
import type { ApiError } from '../../api/client';
import { searchPublicCampaigns } from '../../api/public-campaign-api';
import type { PaginatedCampaigns, PublicCampaignSearchParams } from '../../types/campaign';

export function publicCampaignsQueryKey(
  params: PublicCampaignSearchParams,
): readonly [string, PublicCampaignSearchParams] {
  return ['publicCampaigns', params] as const;
}

export interface UsePublicCampaignsResult {
  readonly data: PaginatedCampaigns | null;
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly error: ApiError | null;
}

/**
 * Hook to search and list public (live/funded) campaigns.
 * Query key: ['publicCampaigns', params]
 * Stale time: 30 seconds.
 * No authentication required.
 */
export function usePublicCampaigns(params: PublicCampaignSearchParams): UsePublicCampaignsResult {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: publicCampaignsQueryKey(params),
    queryFn: () => searchPublicCampaigns(params),
    staleTime: 30_000,
    retry: 1,
  });

  return {
    data: data ?? null,
    isLoading,
    isError,
    error: isError ? (error as ApiError) : null,
  };
}
