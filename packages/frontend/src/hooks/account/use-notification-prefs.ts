import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getNotificationPrefs,
  type NotificationPrefs,
  updateNotificationPrefs,
} from '../../api/account-api';
import { CURRENT_USER_QUERY_KEY } from './use-current-user';

export const NOTIFICATION_PREFS_QUERY_KEY = ['me', 'notifications'] as const;

export interface UseNotificationPrefsResult {
  readonly prefs: NotificationPrefs | null;
  readonly isLoading: boolean;
  readonly updatePrefs: (
    partial: Partial<Omit<NotificationPrefs, 'securityAlerts'>>,
  ) => Promise<void>;
  readonly isUpdating: boolean;
}

/**
 * Hook to fetch and update notification preferences.
 * Immediately saves changes on toggle (no explicit save button).
 */
export function useNotificationPrefs(): UseNotificationPrefsResult {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: NOTIFICATION_PREFS_QUERY_KEY,
    queryFn: getNotificationPrefs,
    staleTime: 30_000,
    retry: 1,
  });

  const mutation = useMutation({
    mutationFn: updateNotificationPrefs,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: NOTIFICATION_PREFS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: CURRENT_USER_QUERY_KEY });
    },
  });

  const updatePrefs = async (
    partial: Partial<Omit<NotificationPrefs, 'securityAlerts'>>,
  ): Promise<void> => {
    await mutation.mutateAsync(partial);
  };

  return {
    prefs: data ?? null,
    isLoading,
    updatePrefs,
    isUpdating: mutation.isPending,
  };
}
