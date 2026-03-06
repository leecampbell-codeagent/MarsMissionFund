import { User } from '../../domain/models/user.js';
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
        accountStatus: 'active',
        onboardingCompleted: false,
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
          accountStatus: existing.accountStatus,
          onboardingCompleted: existing.onboardingCompleted,
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
        accountStatus: 'active',
        onboardingCompleted: false,
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
        accountStatus: status,
        onboardingCompleted: user.onboardingCompleted,
        createdAt: user.createdAt,
        updatedAt: new Date(),
      },
      user.roles,
    );
    this.users.set(clerkUserId, updated);
  }
}
