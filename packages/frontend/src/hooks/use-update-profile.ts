import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTypedApiClient } from '../lib/api-client.js';
import type { MeResponse } from '../types/user.js';

interface UpdateProfileInput {
  readonly displayName?: string | null;
  readonly bio?: string | null;
}

export function useUpdateProfile() {
  const client = useTypedApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateProfileInput) => client.put<MeResponse>('/api/v1/me', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });
}
