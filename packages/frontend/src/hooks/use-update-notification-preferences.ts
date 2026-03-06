import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTypedApiClient } from '../lib/api-client.js';
import type { MeResponse } from '../types/user.js';

interface UpdateNotificationPreferencesInput {
  readonly campaign_updates: boolean;
  readonly milestone_completions: boolean;
  readonly contribution_confirmations: boolean;
  readonly new_recommendations: boolean;
  readonly platform_announcements: boolean;
}

export function useUpdateNotificationPreferences() {
  const client = useTypedApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateNotificationPreferencesInput) =>
      client.put<MeResponse>('/api/v1/me/notification-preferences', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });
}
