import { User } from '../../domain/models/user.js';
import type { NotificationPreferences } from '../../domain/value-objects/notification-preferences.js';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  resolveNotificationPreferences,
} from '../../domain/value-objects/notification-preferences.js';
import type { UserRepository, UserSyncInput } from '../../ports/user-repository.js';

export class MockUserRepository implements UserRepository {
  private readonly users: Map<string, User> = new Map();

  constructor() {
    // Pre-populate with test user for MOCK_AUTH
    const testUser = User.reconstitute(
      {
        id: '00000000-0000-0000-0000-000000000001',
        clerkUserId: 'user_test_mock',
        email: 'test@marsmissionfund.test',
        displayName: null,
        avatarUrl: null,
        bio: null,
        accountStatus: 'active',
        onboardingCompleted: false,
        onboardingStep: null,
        notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES,
        createdAt: new Date('2026-03-06T00:00:00.000Z'),
        updatedAt: new Date('2026-03-06T00:00:00.000Z'),
      },
      ['backer'],
    );
    this.users.set('user_test_mock', testUser);
  }

  async findByClerkId(clerkUserId: string): Promise<User | null> {
    return this.users.get(clerkUserId) ?? null;
  }

  async upsertWithBackerRole(input: UserSyncInput): Promise<User> {
    const existing = this.users.get(input.clerkUserId);
    if (existing) {
      const updated = User.reconstitute(
        {
          id: existing.id,
          clerkUserId: existing.clerkUserId,
          email: input.email,
          displayName: existing.displayName,
          avatarUrl: existing.avatarUrl,
          bio: existing.bio,
          accountStatus: existing.accountStatus,
          onboardingCompleted: existing.onboardingCompleted,
          onboardingStep: existing.onboardingStep,
          notificationPreferences: existing.notificationPreferences,
          createdAt: existing.createdAt,
          updatedAt: new Date(),
        },
        existing.roles.includes('backer') ? existing.roles : [...existing.roles, 'backer'],
      );
      this.users.set(input.clerkUserId, updated);
      return updated;
    }

    const newUser = User.reconstitute(
      {
        id: input.id,
        clerkUserId: input.clerkUserId,
        email: input.email,
        displayName: null,
        avatarUrl: null,
        bio: null,
        accountStatus: 'active',
        onboardingCompleted: false,
        onboardingStep: null,
        notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      ['backer'],
    );
    this.users.set(input.clerkUserId, newUser);
    return newUser;
  }

  async findById(userId: string): Promise<User | null> {
    for (const user of this.users.values()) {
      if (user.id === userId) return user;
    }
    return null;
  }

  async updateProfile(
    userId: string,
    fields: { displayName?: string | null; bio?: string | null },
  ): Promise<User> {
    const user = await this.findById(userId);
    if (!user) throw new Error('User not found');

    const displayNameProvided = 'displayName' in fields;
    const bioProvided = 'bio' in fields;

    const updated = User.reconstitute(
      {
        id: user.id,
        clerkUserId: user.clerkUserId,
        email: user.email,
        displayName: displayNameProvided ? (fields.displayName ?? null) : user.displayName,
        avatarUrl: user.avatarUrl,
        bio: bioProvided ? (fields.bio ?? null) : user.bio,
        accountStatus: user.accountStatus,
        onboardingCompleted: user.onboardingCompleted,
        onboardingStep: user.onboardingStep,
        notificationPreferences: user.notificationPreferences,
        createdAt: user.createdAt,
        updatedAt: new Date(),
      },
      user.roles,
    );
    this.users.set(user.clerkUserId, updated);
    return updated;
  }

  async updateNotificationPreferences(
    userId: string,
    prefs: NotificationPreferences,
  ): Promise<User> {
    const user = await this.findById(userId);
    if (!user) throw new Error('User not found');

    const updated = User.reconstitute(
      {
        id: user.id,
        clerkUserId: user.clerkUserId,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        accountStatus: user.accountStatus,
        onboardingCompleted: user.onboardingCompleted,
        onboardingStep: user.onboardingStep,
        notificationPreferences: resolveNotificationPreferences(prefs),
        createdAt: user.createdAt,
        updatedAt: new Date(),
      },
      user.roles,
    );
    this.users.set(user.clerkUserId, updated);
    return updated;
  }

  async completeOnboarding(
    userId: string,
    input: {
      step: number;
      roles: string[];
      displayName?: string | null;
      bio?: string | null;
    },
  ): Promise<User> {
    const user = await this.findById(userId);
    if (!user) throw new Error('User not found');

    const mergedRoles = [...user.roles];
    for (const role of input.roles) {
      if (!mergedRoles.includes(role)) {
        mergedRoles.push(role);
      }
    }

    const updated = User.reconstitute(
      {
        id: user.id,
        clerkUserId: user.clerkUserId,
        email: user.email,
        displayName: input.displayName ?? null,
        avatarUrl: user.avatarUrl,
        bio: input.bio ?? null,
        accountStatus: user.accountStatus,
        onboardingCompleted: true,
        onboardingStep: input.step,
        notificationPreferences: user.notificationPreferences,
        createdAt: user.createdAt,
        updatedAt: new Date(),
      },
      mergedRoles,
    );
    this.users.set(user.clerkUserId, updated);
    return updated;
  }

  async saveOnboardingStep(userId: string, step: number): Promise<void> {
    const user = await this.findById(userId);
    if (!user) return;

    const updated = User.reconstitute(
      {
        id: user.id,
        clerkUserId: user.clerkUserId,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        accountStatus: user.accountStatus,
        onboardingCompleted: user.onboardingCompleted,
        onboardingStep: step,
        notificationPreferences: user.notificationPreferences,
        createdAt: user.createdAt,
        updatedAt: new Date(),
      },
      user.roles,
    );
    this.users.set(user.clerkUserId, updated);
  }

  /** Test helper: set account status for a user by clerkUserId */
  setAccountStatus(
    clerkUserId: string,
    status: 'active' | 'suspended' | 'deactivated' | 'deleted' | 'pending_verification',
  ): void {
    const user = this.users.get(clerkUserId);
    if (!user) return;
    const updated = User.reconstitute(
      {
        id: user.id,
        clerkUserId: user.clerkUserId,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        accountStatus: status,
        onboardingCompleted: user.onboardingCompleted,
        onboardingStep: user.onboardingStep,
        notificationPreferences: user.notificationPreferences,
        createdAt: user.createdAt,
        updatedAt: new Date(),
      },
      user.roles,
    );
    this.users.set(clerkUserId, updated);
  }
}
