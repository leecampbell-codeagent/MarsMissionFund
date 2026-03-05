/**
 * KYC API functions — typed wrappers around the API client.
 * Maps to endpoints defined in feat-002-spec-api.md.
 */

import { apiClient } from './client';
import { type UserProfile } from './account-api';

export type KycStatus = 'not_started' | 'pending' | 'in_review' | 'verified' | 'rejected' | 'expired';

export interface KycStatusResponse {
  readonly kycStatus: KycStatus;
  readonly updatedAt: string; // ISO 8601 string
}

interface GetKycStatusApiResponse {
  readonly data: KycStatusResponse;
}

interface SubmitKycApiResponse {
  readonly data: UserProfile;
}

/**
 * GET /api/v1/kyc/status
 * Returns the current authenticated user's KYC verification status.
 */
export async function getKycStatus(): Promise<KycStatusResponse> {
  const response = await apiClient<GetKycStatusApiResponse>({
    method: 'GET',
    path: '/kyc/status',
  });
  return response.data;
}

/**
 * POST /api/v1/kyc/submit
 * Initiates or resubmits KYC verification.
 * Returns the full updated user profile (stub auto-approves synchronously).
 */
export async function submitKyc(): Promise<UserProfile> {
  const response = await apiClient<SubmitKycApiResponse>({
    method: 'POST',
    path: '/kyc/submit',
  });
  return response.data;
}
