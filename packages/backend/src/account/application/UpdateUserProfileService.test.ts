import { describe, expect, it, vi } from 'vitest';
import { UserNotFoundError } from '../domain/errors/UserNotFoundError';
import { KycStatus } from '../domain/KycStatus';
import { Role } from '../domain/Role';
import { User } from '../domain/User';
import type { UserRepository } from '../ports/UserRepository';
import { UpdateUserProfileService } from './UpdateUserProfileService';

function makeUser(overrides: Partial<{ displayName: string; bio: string | null }> = {}): User {
  return User.reconstitute({
    id: 'user-uuid-001',
    clerkId: 'clerk_mock_001',
    email: 'astronaut@mars.example',
    displayName: overrides.displayName ?? 'Astro Naut',
    avatarUrl: null,
    bio: overrides.bio ?? null,
    roles: [Role.Backer],
    kycStatus: KycStatus.NotVerified,
    onboardingCompleted: false,
    createdAt: new Date('2026-03-07T00:00:00Z'),
    updatedAt: new Date('2026-03-07T00:00:00Z'),
  });
}

function makeRepo(returnValue: User | null): UserRepository {
  return {
    findByClerkId: vi.fn(),
    findById: vi.fn(),
    upsert: vi.fn(),
    updateProfile: vi.fn().mockResolvedValue(returnValue),
    updateRoles: vi.fn(),
  };
}

describe('UpdateUserProfileService', () => {
  it('returns updated user when repo returns a user', async () => {
    const updated = makeUser({ displayName: 'New Name', bio: 'Bio text' });
    const repo = makeRepo(updated);
    const svc = new UpdateUserProfileService(repo);

    const result = await svc.execute('user-uuid-001', {
      displayName: 'New Name',
      bio: 'Bio text',
    });

    expect(result).toBe(updated);
    expect(repo.updateProfile).toHaveBeenCalledWith('user-uuid-001', {
      displayName: 'New Name',
      bio: 'Bio text',
    });
  });

  it('throws UserNotFoundError when repo returns null', async () => {
    const repo = makeRepo(null);
    const svc = new UpdateUserProfileService(repo);

    await expect(svc.execute('nonexistent-uuid', { displayName: 'X' })).rejects.toBeInstanceOf(
      UserNotFoundError,
    );
  });

  it('passes null fields through to repo', async () => {
    const user = makeUser();
    const repo = makeRepo(user);
    const svc = new UpdateUserProfileService(repo);

    await svc.execute('user-uuid-001', { displayName: null, bio: null, avatarUrl: null });

    expect(repo.updateProfile).toHaveBeenCalledWith('user-uuid-001', {
      displayName: null,
      bio: null,
      avatarUrl: null,
    });
  });
});
