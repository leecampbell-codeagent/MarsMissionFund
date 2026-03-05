import { useQuery } from '@tanstack/react-query';
import { getKycStatus, type KycStatusResponse } from '../../api/kyc-api';
import { type ApiError } from '../../api/client';

export const KYC_STATUS_QUERY_KEY = ['kyc', 'status'] as const;

export interface UseKycStatusResult {
  readonly kycStatus: KycStatusResponse | null;
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly error: ApiError | null;
}

/**
 * Hook to fetch the current authenticated user's KYC verification status.
 * Query key: ['kyc', 'status']
 * staleTime: 0 — KYC status is authoritative real-time data (EC-011)
 * Retries once on failure.
 * Refetches on window focus to capture async status changes.
 */
export function useKycStatus(): UseKycStatusResult {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: KYC_STATUS_QUERY_KEY,
    queryFn: getKycStatus,
    staleTime: 0,
    retry: 1,
    refetchOnWindowFocus: true,
  });

  return {
    kycStatus: data ?? null,
    isLoading,
    isError,
    error: isError ? (error as ApiError) : null,
  };
}
