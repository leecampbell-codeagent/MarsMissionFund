import type { UpdateProfileInput, User } from '../domain/models/user.js';
import type { AccountStatus } from '../domain/value-objects/account-status.js';
import type { NotificationPreferences } from '../domain/value-objects/notification-preferences.js';
import type { Role } from '../domain/value-objects/role.js';

export interface UserRepository {
  save(user: User): Promise<void>;
  upsertByClerkUserId(user: User): Promise<User>;
  findById(id: string): Promise<User | null>;
  findByClerkUserId(clerkUserId: string): Promise<User | null>;
  updateProfile(clerkUserId: string, input: UpdateProfileInput): Promise<User>;
  updateNotificationPrefs(clerkUserId: string, prefs: NotificationPreferences): Promise<User>;
  updateAccountStatus(
    clerkUserId: string,
    status: AccountStatus,
    roles: Role[],
    email?: string,
  ): Promise<User>;
  touchLastSeen(clerkUserId: string): Promise<void>;
}




























