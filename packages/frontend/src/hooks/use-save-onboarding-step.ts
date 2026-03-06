import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTypedApiClient } from '../lib/api-client.js';
import type { MeResponse } from '../types/user.js';

interface SaveOnboardingStepInput {
  readonly step: number;
}

export function useSaveOnboardingStep() {
  const client = useTypedApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SaveOnboardingStepInput) =>
      client.patch<MeResponse>('/api/v1/me/onboarding/step', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });
}
