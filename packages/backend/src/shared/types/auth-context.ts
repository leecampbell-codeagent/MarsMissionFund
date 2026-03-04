import type { AccountStatus } from '../../account/domain/account.js';

export interface AuthContext {
  readonly userId: string;
  readonly clerkUserId: string;
  readonly email: string;
  readonly displayName: string | null;
  readonly roles: readonly string[];
  readonly accountStatus: AccountStatus;
  readonly onboardingCompleted: boolean;
}
