import type { User } from '../domain/models/user.js';
import type { NotificationPreferences } from '../domain/value-objects/notification-preferences.js';

export interface UserSyncInput {
  readonly id: string;
  readonly clerkUserId: string;
  readonly email: string;
}

export interface UserRepository {
  findByClerkId(clerkUserId: string): Promise<User | null>;
  upsertWithBackerRole(input: UserSyncInput): Promise<User>;
  findById(userId: string): Promise<User | null>;
  updateProfile(
    userId: string,
    fields: { displayName?: string | null; bio?: string | null },
  ): Promise<User>;
  updateNotificationPreferences(userId: string, prefs: NotificationPreferences): Promise<User>;
  completeOnboarding(
    userId: string,
    input: {
      step: number;
      roles: string[];
      displayName?: string | null;
      bio?: string | null;
    },
  ): Promise<User>;
  saveOnboardingStep(userId: string, step: number): Promise<void>;
}
