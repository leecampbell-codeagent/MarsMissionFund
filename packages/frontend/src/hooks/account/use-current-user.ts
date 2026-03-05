import { useQuery } from '@tanstack/react-query';
import { getCurrentUser, type UserProfile } from '../../api/account-api';
import type { ApiError } from '../../api/client';

export const CURRENT_USER_QUERY_KEY = ['me'] as const;

export interface UseCurrentUserResult {
  readonly user: UserProfile | null;
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly error: ApiError | null;
}

/**
 * Hook to fetch the current authenticated user's profile.
 * Query key: ['me']
 * Stale time: 30 seconds
 * Retries once on failure.
 */
export function useCurrentUser(): UseCurrentUserResult {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: CURRENT_USER_QUERY_KEY,
    queryFn: getCurrentUser,
    staleTime: 30_000,
    retry: 1,
    refetchOnWindowFocus: true,
  });

  return {
    user: data ?? null,
    isLoading,
    isError,
    error: isError ? (error as ApiError) : null,
  };
}
