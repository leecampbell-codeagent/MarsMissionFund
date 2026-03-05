/**
 * Campaign API functions — typed wrappers around the API client.
 * Maps to endpoints defined in feat-003-spec-api.md.
 */

import type { Campaign, CampaignSummary, UpdateCampaignInput } from '../types/campaign';
import type { UserProfile } from './account-api';
import { apiClient } from './client';

interface CampaignResponse {
  readonly data: Campaign;
}

interface CampaignListResponse {
  readonly data: CampaignSummary[];
}

interface AssignCreatorRoleResponse {
  readonly data: UserProfile;
}

/**
 * POST /api/v1/campaigns
 * Creates a new campaign draft with the given title.
 * Requires Creator role + KYC verified.
 */
export async function createCampaign(input: { title: string }): Promise<Campaign> {
  const response = await apiClient<CampaignResponse>({
    method: 'POST',
    path: '/campaigns',
    body: input,
  });
  return response.data;
}

/**
 * PATCH /api/v1/campaigns/:id
 * Partially updates a campaign draft (auto-save).
 * Only structural validation applies — no required-field checks.
 */
export async function updateCampaign(id: string, input: UpdateCampaignInput): Promise<Campaign> {
  const response = await apiClient<CampaignResponse>({
    method: 'PATCH',
    path: `/campaigns/${id}`,
    body: input,
  });
  return response.data;
}

/**
 * POST /api/v1/campaigns/:id/submit
 * Submits a campaign draft for review.
 * Full strict validation applied server-side.
 */
export async function submitCampaign(id: string): Promise<Campaign> {
  const response = await apiClient<CampaignResponse>({
    method: 'POST',
    path: `/campaigns/${id}/submit`,
  });
  return response.data;
}

/**
 * GET /api/v1/campaigns/:id
 * Returns a campaign by ID.
 * Access control is enforced by role and status.
 */
export async function getCampaign(id: string): Promise<Campaign> {
  const response = await apiClient<CampaignResponse>({
    method: 'GET',
    path: `/campaigns/${id}`,
  });
  return response.data;
}

/**
 * GET /api/v1/me/campaigns
 * Returns all campaigns created by the authenticated user.
 */
export async function listMyCampaigns(): Promise<CampaignSummary[]> {
  const response = await apiClient<CampaignListResponse>({
    method: 'GET',
    path: '/me/campaigns',
  });
  return response.data;
}

/**
 * GET /api/v1/campaigns/review-queue
 * Returns campaigns in 'submitted' status in FIFO order.
 * Requires Reviewer or Admin role.
 */
export async function getReviewQueue(): Promise<CampaignSummary[]> {
  const response = await apiClient<CampaignListResponse>({
    method: 'GET',
    path: '/campaigns/review-queue',
  });
  return response.data;
}

/**
 * POST /api/v1/campaigns/:id/claim
 * Claims a submitted campaign for review.
 * Requires Reviewer role.
 */
export async function claimCampaign(id: string): Promise<Campaign> {
  const response = await apiClient<CampaignResponse>({
    method: 'POST',
    path: `/campaigns/${id}/claim`,
  });
  return response.data;
}

/**
 * POST /api/v1/campaigns/:id/approve
 * Approves a campaign under review.
 * Requires the assigned reviewer or Admin.
 */
export async function approveCampaign(
  id: string,
  input: { reviewNotes: string },
): Promise<Campaign> {
  const response = await apiClient<CampaignResponse>({
    method: 'POST',
    path: `/campaigns/${id}/approve`,
    body: input,
  });
  return response.data;
}

/**
 * POST /api/v1/campaigns/:id/reject
 * Rejects a campaign under review.
 * Requires the assigned reviewer or Admin.
 */
export async function rejectCampaign(
  id: string,
  input: { rejectionReason: string; resubmissionGuidance: string },
): Promise<Campaign> {
  const response = await apiClient<CampaignResponse>({
    method: 'POST',
    path: `/campaigns/${id}/reject`,
    body: input,
  });
  return response.data;
}

/**
 * POST /api/v1/campaigns/:id/launch
 * Launches an approved campaign to Live status.
 * Requires Creator role and campaign ownership.
 */
export async function launchCampaign(id: string): Promise<Campaign> {
  const response = await apiClient<CampaignResponse>({
    method: 'POST',
    path: `/campaigns/${id}/launch`,
  });
  return response.data;
}

/**
 * POST /api/v1/campaigns/:id/archive
 * Archives a campaign.
 * Creator can archive draft/rejected. Admin can archive any.
 */
export async function archiveCampaign(id: string): Promise<Campaign> {
  const response = await apiClient<CampaignResponse>({
    method: 'POST',
    path: `/campaigns/${id}/archive`,
  });
  return response.data;
}

/**
 * POST /api/v1/campaigns/:id/reassign
 * Reassigns the reviewer for an under_review campaign.
 * Admin only.
 */
export async function reassignReviewer(
  id: string,
  input: { reviewerUserId: string },
): Promise<Campaign> {
  const response = await apiClient<CampaignResponse>({
    method: 'POST',
    path: `/campaigns/${id}/reassign`,
    body: input,
  });
  return response.data;
}

/**
 * POST /api/v1/me/roles/creator
 * Assigns the creator role to the authenticated user.
 * Requires KYC verified and active account. Idempotent.
 */
export async function assignCreatorRole(): Promise<UserProfile> {
  const response = await apiClient<AssignCreatorRoleResponse>({
    method: 'POST',
    path: '/me/roles/creator',
  });
  return response.data;
}
