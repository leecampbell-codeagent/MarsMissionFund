import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTypedApiClient } from '../lib/api-client.js';
import type { MeResponse } from '../types/user.js';

interface CompleteOnboardingInput {
  readonly step: number;
  readonly roles: string[];
  readonly displayName?: string;
  readonly bio?: string;
}

export function useCompleteOnboarding() {
  const client = useTypedApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CompleteOnboardingInput) =>
      client.post<MeResponse>('/api/v1/me/onboarding/complete', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });
}
