/**
 * Contribution API functions — typed wrappers around the authenticated API client.
 * Maps to endpoints defined in feat-005-spec-api.md.
 */

import type { Contribution, CreateContributionInput } from '../types/contribution';
import { apiClient } from './client';

interface ContributionResponse {
  readonly data: Contribution;
}

interface ContributionListResponse {
  readonly data: Contribution[];
}

/**
 * POST /api/v1/contributions
 * Creates a new contribution. Always resolves (never throws for payment failure).
 * The returned contribution may have status 'failed' — check status field.
 * Throws ApiError for validation (400), auth (401), duplicate (409), campaign (422/404) errors.
 */
export async function createContribution(input: CreateContributionInput): Promise<Contribution> {
  const response = await apiClient<ContributionResponse>({
    method: 'POST',
    path: '/contributions',
    body: input,
  });
  return response.data;
}

/**
 * GET /api/v1/contributions/:id
 * Returns the authenticated user's contribution by ID.
 * Throws ApiError 404 if not found or belongs to another user.
 */
export async function getContribution(id: string): Promise<Contribution> {
  const response = await apiClient<ContributionResponse>({
    method: 'GET',
    path: `/contributions/${id}`,
  });
  return response.data;
}

/**
 * GET /api/v1/campaigns/:campaignId/contributions
 * Returns the authenticated user's contributions to a specific campaign.
 */
export async function listCampaignContributions(
  campaignId: string,
  limit = 20,
  offset = 0,
): Promise<Contribution[]> {
  const response = await apiClient<ContributionListResponse>({
    method: 'GET',
    path: `/campaigns/${campaignId}/contributions?limit=${limit}&offset=${offset}`,
  });
  return response.data;
}
