import { KycTransitionConflictError } from '../../kyc/domain/errors/kyc-errors.js';
import { UserNotFoundError } from '../domain/errors/account-errors.js';
import { type UpdateProfileInput, User } from '../domain/models/user.js';
import type { AccountStatus } from '../domain/value-objects/account-status.js';
import type { KycStatus } from '../domain/value-objects/kyc-status.js';
import type { NotificationPreferences } from '../domain/value-objects/notification-preferences.js';
import type { Role } from '../domain/value-objects/role.js';
import type { UserRepository } from '../ports/user-repository.port.js';

/**
 * In-memory implementation for tests.
 * Exposed `users` map allows test assertions.
 */
export class InMemoryUserRepository implements UserRepository {
  readonly users: Map<string, User> = new Map(); // key: clerkUserId

  async save(user: User): Promise<void> {
    this.users.set(user.clerkUserId, user);
  }

  async upsertByClerkUserId(user: User): Promise<User> {
    const existing = this.users.get(user.clerkUserId);
    if (existing) {
      // Update email and lastSeenAt only — do NOT overwrite account_status or roles
      const updated = User.reconstitute({
        id: existing.id,
        clerkUserId: existing.clerkUserId,
        email: user.email,
        displayName: existing.displayName,
        bio: existing.bio,
        avatarUrl: existing.avatarUrl,
        accountStatus: existing.accountStatus,
        onboardingCompleted: existing.onboardingCompleted,
        onboardingStep: existing.onboardingStep,
        roles: existing.roles,
        notificationPrefs: existing.notificationPrefs,
        kycStatus: existing.kycStatus,
        lastSeenAt: new Date(),
        createdAt: existing.createdAt,
        updatedAt: new Date(),
      });
      this.users.set(user.clerkUserId, updated);
      return updated;
    }
    this.users.set(user.clerkUserId, user);
    return user;
  }

  async findById(id: string): Promise<User | null> {
    for (const user of this.users.values()) {
      if (user.id === id) return user;
    }
    return null;
  }

  async findByClerkUserId(clerkUserId: string): Promise<User | null> {
    return this.users.get(clerkUserId) ?? null;
  }

  async updateProfile(clerkUserId: string, input: UpdateProfileInput): Promise<User> {
    const existing = this.users.get(clerkUserId);
    if (!existing) {
      throw new UserNotFoundError(clerkUserId);
    }

    const updated = existing.updateProfile(input);
    this.users.set(clerkUserId, updated);
    return updated;
  }

  async updateNotificationPrefs(
    clerkUserId: string,
    prefs: NotificationPreferences,
  ): Promise<User> {
    const existing = this.users.get(clerkUserId);
    if (!existing) {
      throw new UserNotFoundError(clerkUserId);
    }

    const updated = User.reconstitute({
      ...{
        id: existing.id,
        clerkUserId: existing.clerkUserId,
        email: existing.email,
        displayName: existing.displayName,
        bio: existing.bio,
        avatarUrl: existing.avatarUrl,
        accountStatus: existing.accountStatus,
        onboardingCompleted: existing.onboardingCompleted,
        onboardingStep: existing.onboardingStep,
        roles: existing.roles,
        notificationPrefs: existing.notificationPrefs,
        kycStatus: existing.kycStatus,
        lastSeenAt: existing.lastSeenAt,
        createdAt: existing.createdAt,
        updatedAt: existing.updatedAt,
      },
      notificationPrefs: prefs,
      updatedAt: new Date(),
    });
    this.users.set(clerkUserId, updated);
    return updated;
  }

  async updateAccountStatus(
    clerkUserId: string,
    status: AccountStatus,
    roles: Role[],
    email?: string,
  ): Promise<User> {
    const existing = this.users.get(clerkUserId);
    if (!existing) {
      throw new UserNotFoundError(clerkUserId);
    }

    const updated = User.reconstitute({
      id: existing.id,
      clerkUserId: existing.clerkUserId,
      email: email ?? existing.email,
      displayName: existing.displayName,
      bio: existing.bio,
      avatarUrl: existing.avatarUrl,
      accountStatus: status,
      onboardingCompleted: existing.onboardingCompleted,
      onboardingStep: existing.onboardingStep,
      roles,
      notificationPrefs: existing.notificationPrefs,
      kycStatus: existing.kycStatus,
      lastSeenAt: existing.lastSeenAt,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    });
    this.users.set(clerkUserId, updated);
    return updated;
  }

  async updateKycStatus(
    clerkUserId: string,
    fromStatus: KycStatus,
    toStatus: KycStatus,
  ): Promise<User> {
    const existing = this.users.get(clerkUserId);
    if (!existing) {
      throw new KycTransitionConflictError();
    }

    if (existing.kycStatus !== fromStatus) {
      throw new KycTransitionConflictError();
    }

    const updated = User.reconstitute({
      id: existing.id,
      clerkUserId: existing.clerkUserId,
      email: existing.email,
      displayName: existing.displayName,
      bio: existing.bio,
      avatarUrl: existing.avatarUrl,
      accountStatus: existing.accountStatus,
      onboardingCompleted: existing.onboardingCompleted,
      onboardingStep: existing.onboardingStep,
      roles: existing.roles,
      notificationPrefs: existing.notificationPrefs,
      kycStatus: toStatus,
      lastSeenAt: existing.lastSeenAt,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    });
    this.users.set(clerkUserId, updated);
    return updated;
  }

  async touchLastSeen(clerkUserId: string): Promise<void> {
    const existing = this.users.get(clerkUserId);
    if (!existing) return; // No-op if not found

    const updated = existing.touchLastSeen();
    this.users.set(clerkUserId, updated);
  }

  async completeOnboarding(clerkUserId: string): Promise<User> {
    const existing = this.users.get(clerkUserId);
    if (!existing) {
      throw new UserNotFoundError(clerkUserId);
    }

    const updated = User.reconstitute({
      id: existing.id,
      clerkUserId: existing.clerkUserId,
      email: existing.email,
      displayName: existing.displayName,
      bio: existing.bio,
      avatarUrl: existing.avatarUrl,
      accountStatus: existing.accountStatus,
      onboardingCompleted: true,
      onboardingStep: 'complete',
      roles: existing.roles,
      notificationPrefs: existing.notificationPrefs,
      kycStatus: existing.kycStatus,
      lastSeenAt: existing.lastSeenAt,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    });
    this.users.set(clerkUserId, updated);
    return updated;
  }
}
