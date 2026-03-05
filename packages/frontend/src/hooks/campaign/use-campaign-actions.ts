import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  claimCampaign,
  approveCampaign,
  rejectCampaign,
  launchCampaign,
  archiveCampaign,
  reassignReviewer,
} from '../../api/campaign-api';
import { type Campaign } from '../../types/campaign';
import { type ApiError } from '../../api/client';
import { campaignQueryKey } from './use-campaign';
import { MY_CAMPAIGNS_QUERY_KEY } from './use-my-campaigns';
import { REVIEW_QUEUE_QUERY_KEY } from './use-review-queue';

/**
 * Hook providing all review/action mutations for the campaign detail page.
 * All mutations invalidate the ['campaign', id] query on success.
 */
export function useCampaignActions(campaignId: string) {
  const queryClient = useQueryClient();

  function invalidateCampaign(campaign: Campaign) {
    queryClient.setQueryData(campaignQueryKey(campaign.id), campaign);
    void queryClient.invalidateQueries({ queryKey: campaignQueryKey(campaign.id) });
    void queryClient.invalidateQueries({ queryKey: MY_CAMPAIGNS_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: REVIEW_QUEUE_QUERY_KEY });
  }

  const claimMutation = useMutation({
    mutationFn: () => claimCampaign(campaignId),
    onSuccess: invalidateCampaign,
  });

  const approveMutation = useMutation({
    mutationFn: (input: { reviewNotes: string }) => approveCampaign(campaignId, input),
    onSuccess: invalidateCampaign,
  });

  const rejectMutation = useMutation({
    mutationFn: (input: { rejectionReason: string; resubmissionGuidance: string }) =>
      rejectCampaign(campaignId, input),
    onSuccess: invalidateCampaign,
  });

  const launchMutation = useMutation({
    mutationFn: () => launchCampaign(campaignId),
    onSuccess: invalidateCampaign,
  });

  const archiveMutation = useMutation({
    mutationFn: () => archiveCampaign(campaignId),
    onSuccess: invalidateCampaign,
  });

  const reassignMutation = useMutation({
    mutationFn: (input: { reviewerUserId: string }) => reassignReviewer(campaignId, input),
    onSuccess: invalidateCampaign,
  });

  return {
    claim: {
      mutate: () => claimMutation.mutate(),
      isLoading: claimMutation.isPending,
      isError: claimMutation.isError,
      error: claimMutation.isError ? (claimMutation.error as ApiError) : null,
    },
    approve: {
      mutate: (input: { reviewNotes: string }) => approveMutation.mutate(input),
      isLoading: approveMutation.isPending,
      isError: approveMutation.isError,
      error: approveMutation.isError ? (approveMutation.error as ApiError) : null,
    },
    reject: {
      mutate: (input: { rejectionReason: string; resubmissionGuidance: string }) =>
        rejectMutation.mutate(input),
      isLoading: rejectMutation.isPending,
      isError: rejectMutation.isError,
      error: rejectMutation.isError ? (rejectMutation.error as ApiError) : null,
    },
    launch: {
      mutate: () => launchMutation.mutate(),
      isLoading: launchMutation.isPending,
      isError: launchMutation.isError,
      error: launchMutation.isError ? (launchMutation.error as ApiError) : null,
    },
    archive: {
      mutate: () => archiveMutation.mutate(),
      isLoading: archiveMutation.isPending,
      isError: archiveMutation.isError,
      error: archiveMutation.isError ? (archiveMutation.error as ApiError) : null,
    },
    reassign: {
      mutate: (input: { reviewerUserId: string }) => reassignMutation.mutate(input),
      isLoading: reassignMutation.isPending,
      isError: reassignMutation.isError,
      error: reassignMutation.isError ? (reassignMutation.error as ApiError) : null,
    },
  };
}
