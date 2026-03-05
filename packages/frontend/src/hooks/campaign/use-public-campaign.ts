import { useQuery } from '@tanstack/react-query';
import type { ApiError } from '../../api/client';
import { getPublicCampaign } from '../../api/public-campaign-api';
import type { PublicCampaignDetail } from '../../types/campaign';

export function publicCampaignQueryKey(id: string): readonly [string, string] {
  return ['publicCampaign', id] as const;
}

export interface UsePublicCampaignResult {
  readonly campaign: PublicCampaignDetail | null;
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly error: ApiError | null;
}

/**
 * Hook to fetch a single public campaign by ID.
 * Query key: ['publicCampaign', id]
 * Stale time: 30 seconds.
 * No authentication required.
 * On 404: isError is true, error.status === 404.
 */
export function usePublicCampaign(id: string): UsePublicCampaignResult {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: publicCampaignQueryKey(id),
    queryFn: () => getPublicCampaign(id),
    staleTime: 30_000,
    retry: (failureCount, err) => {
      // Do not retry on 404 (campaign not found or not public)
      const apiError = err as ApiError;
      if (apiError?.status === 404) return false;
      return failureCount < 1;
    },
    enabled: Boolean(id),
  });

  return {
    campaign: data ?? null,
    isLoading,
    isError,
    error: isError ? (error as ApiError) : null,
  };
}
