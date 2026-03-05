import { useQuery } from '@tanstack/react-query';
import { getReviewQueue } from '../../api/campaign-api';
import { type CampaignSummary } from '../../types/campaign';
import { type ApiError } from '../../api/client';

export const REVIEW_QUEUE_QUERY_KEY = ['reviewQueue'] as const;

export interface UseReviewQueueResult {
  readonly campaigns: CampaignSummary[];
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly error: ApiError | null;
}

/**
 * Hook to fetch the review queue for Reviewers/Admins.
 * Polls every 60 seconds for new submissions.
 * Query key: ['reviewQueue']
 */
export function useReviewQueue(): UseReviewQueueResult {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: REVIEW_QUEUE_QUERY_KEY,
    queryFn: getReviewQueue,
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 1,
  });

  return {
    campaigns: data ?? [],
    isLoading,
    isError,
    error: isError ? (error as ApiError) : null,
  };
}
