/**
 * Public Campaign API — unauthenticated endpoints.
 * Maps to GET /api/v1/public/campaigns/* (no Clerk JWT required).
 * Never use the authenticated apiClient here — these endpoints are public.
 */

import { ApiError } from './client';
import {
  type PublicCampaignListItem,
  type PublicCampaignDetail,
  type PublicCampaignSearchParams,
  type PaginatedCampaigns,
  type PublicCategoryStats,
} from '../types/campaign';

interface PublicCampaignDetailResponse {
  readonly data: PublicCampaignDetail;
}

interface CategoryStatsResponse {
  readonly data: PublicCategoryStats;
}

/**
 * Unauthenticated fetch helper for public campaign endpoints.
 * Hits /api/v1/public/[path] — no Authorization header.
 */
async function publicFetch<T>(path: string): Promise<T> {
  const url = new URL(`/api/v1/public${path}`, window.location.origin);

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Check your connection.');
  }

  if (!response.ok) {
    let errorBody: { error?: { code?: string; message?: string } } = {};
    try {
      errorBody = await response.json();
    } catch {
      // Non-JSON response
    }
    throw new ApiError(
      response.status,
      errorBody.error?.code ?? 'UNKNOWN_ERROR',
      errorBody.error?.message ?? 'An unexpected error occurred.',
    );
  }

  const contentType = response.headers.get('content-type');
  if (!contentType?.includes('application/json')) {
    throw new ApiError(response.status, 'INVALID_RESPONSE', 'Expected JSON response from server.');
  }

  return response.json() as Promise<T>;
}

/**
 * GET /api/v1/public/campaigns
 * Searches and lists public (live/funded) campaigns with optional filters.
 * Accessible without authentication.
 */
export async function searchPublicCampaigns(
  params: PublicCampaignSearchParams,
): Promise<PaginatedCampaigns> {
  const url = new URL('/api/v1/public/campaigns', window.location.origin);

  if (params.q) url.searchParams.set('q', params.q);
  if (params.status) url.searchParams.set('status', params.status);
  if (params.sort) url.searchParams.set('sort', params.sort);
  if (params.limit !== undefined) url.searchParams.set('limit', String(params.limit));
  if (params.offset !== undefined) url.searchParams.set('offset', String(params.offset));

  // category can be single string or array
  if (params.category) {
    const categories = Array.isArray(params.category) ? params.category : [params.category];
    categories.forEach((cat) => url.searchParams.append('category', cat));
  }

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Check your connection.');
  }

  if (!response.ok) {
    let errorBody: { error?: { code?: string; message?: string } } = {};
    try {
      errorBody = await response.json();
    } catch {
      // Non-JSON response
    }
    throw new ApiError(
      response.status,
      errorBody.error?.code ?? 'UNKNOWN_ERROR',
      errorBody.error?.message ?? 'An unexpected error occurred.',
    );
  }

  return response.json() as Promise<PaginatedCampaigns>;
}

/**
 * GET /api/v1/public/campaigns/:id
 * Returns full public detail for a live or funded campaign.
 * Accessible without authentication.
 * Throws ApiError with status 404 for non-public or non-existent campaigns.
 */
export async function getPublicCampaign(id: string): Promise<PublicCampaignDetail> {
  const response = await publicFetch<PublicCampaignDetailResponse>(`/campaigns/${id}`);
  return response.data;
}

/**
 * GET /api/v1/public/campaigns/stats?category=X
 * Returns aggregate statistics for a single category.
 * Accessible without authentication.
 */
export async function getCategoryStats(category: string): Promise<PublicCategoryStats> {
  const url = `/campaigns/stats?category=${encodeURIComponent(category)}`;
  const response = await publicFetch<CategoryStatsResponse>(url);
  return response.data;
}

export type { PublicCampaignListItem, PublicCampaignDetail, PaginatedCampaigns, PublicCategoryStats };
