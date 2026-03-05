/**
 * Auth abstractions over Clerk.
 *
 * CRITICAL: All components must import from this file, never from @clerk/clerk-react directly.
 * When VITE_MOCK_AUTH=true, ClerkProvider is not mounted and direct Clerk imports will crash.
 */

import { SignedIn, SignedOut, useAuth, useUser } from '@clerk/clerk-react';
import type { ReactElement, ReactNode } from 'react';

export interface AppAuthState {
  readonly isLoaded: boolean;
  readonly isSignedIn: boolean | undefined;
  readonly userId: string | null | undefined;
  readonly getToken: () => Promise<string | null>;
  readonly signOut: ReturnType<typeof useAuth>['signOut'];
}

export interface AppUser {
  readonly id: string;
  readonly primaryEmailAddress: string | null;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly imageUrl: string;
}

/**
 * useAppAuth — abstraction over Clerk's useAuth.
 * Always use this instead of useAuth() from @clerk/clerk-react.
 */
export function useAppAuth(): AppAuthState {
  const auth = useAuth();
  return {
    isLoaded: auth.isLoaded,
    isSignedIn: auth.isSignedIn,
    userId: auth.userId,
    getToken: auth.getToken,
    signOut: auth.signOut,
  };
}

/**
 * useAppUser — abstraction over Clerk's useUser.
 */
export function useAppUser(): { isLoaded: boolean; user: AppUser | null | undefined } {
  const { isLoaded, user } = useUser();
  if (!isLoaded || !user) {
    return { isLoaded, user: user ?? null };
  }
  return {
    isLoaded,
    user: {
      id: user.id,
      primaryEmailAddress: user.primaryEmailAddress?.emailAddress ?? null,
      firstName: user.firstName,
      lastName: user.lastName,
      imageUrl: user.imageUrl,
    },
  };
}

interface AppSignedInProps {
  readonly children: ReactNode;
}

/**
 * AppSignedIn — renders children only when user is authenticated.
 * Abstraction over Clerk's SignedIn component.
 */
export function AppSignedIn({ children }: AppSignedInProps): ReactElement {
  return <SignedIn>{children}</SignedIn>;
}

interface AppSignedOutProps {
  readonly children: ReactNode;
}

/**
 * AppSignedOut — renders children only when user is not authenticated.
 * Abstraction over Clerk's SignedOut component.
 */
export function AppSignedOut({ children }: AppSignedOutProps): ReactElement {
  return <SignedOut>{children}</SignedOut>;
}
