import { useQuery } from '@tanstack/react-query';
import { getCampaign } from '../../api/campaign-api';
import { type Campaign } from '../../types/campaign';
import { type ApiError } from '../../api/client';

export function campaignQueryKey(id: string): readonly [string, string] {
  return ['campaign', id] as const;
}

export interface UseCampaignResult {
  readonly campaign: Campaign | null;
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly error: ApiError | null;
}

/**
 * Hook to fetch a single campaign by ID.
 * Query key: ['campaign', id]
 * Stale time: 30 seconds
 */
export function useCampaign(id: string): UseCampaignResult {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: campaignQueryKey(id),
    queryFn: () => getCampaign(id),
    staleTime: 30_000,
    retry: 1,
    enabled: Boolean(id),
  });

  return {
    campaign: data ?? null,
    isLoading,
    isError,
    error: isError ? (error as ApiError) : null,
  };
}
