import { useAuth } from '@clerk/react';
import { useQuery } from '@tanstack/react-query';
import { createApiClient } from '../api/client';

export interface UserProfile {
  readonly id: string;
  readonly email: string;
  readonly displayName: string | null;
  readonly avatarUrl: string | null;
  readonly bio: string | null;
  readonly roles: readonly string[];
  readonly kycStatus: string;
  readonly onboardingCompleted: boolean;
}

export function useCurrentUser() {
  const { isSignedIn, getToken } = useAuth();
  const apiClient = createApiClient(getToken);

  return useQuery<UserProfile>({
    queryKey: ['currentUser'],
    queryFn: () => apiClient.get<UserProfile>('/v1/me'),
    enabled: isSignedIn === true,
    staleTime: 5 * 60 * 1000, // 5 minutes — aligns with Clerk access token lifetime
  });
}
