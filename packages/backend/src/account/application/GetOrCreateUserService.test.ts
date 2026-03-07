import { describe, expect, it, vi } from 'vitest';
import { KycStatus } from '../domain/KycStatus';
import { Role } from '../domain/Role';
import { User } from '../domain/User';
import type { UserRepository } from '../ports/UserRepository';
import { GetOrCreateUserService } from './GetOrCreateUserService';

function makeUser(clerkId: string, email: string): User {
  return User.reconstitute({
    id: 'uuid-1',
    clerkId,
    email,
    displayName: null,
    avatarUrl: null,
    bio: null,
    roles: [Role.Backer],
    kycStatus: KycStatus.NotVerified,
    onboardingCompleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function makeMockRepo(overrides: Partial<UserRepository> = {}): UserRepository {
  return {
    findByClerkId: vi.fn().mockResolvedValue(null),
    findById: vi.fn().mockResolvedValue(null),
    upsert: vi.fn().mockImplementation((u: User) => Promise.resolve(u)),
    updateProfile: vi.fn().mockResolvedValue(null),
    updateRoles: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

describe('GetOrCreateUserService', () => {
  it('returns existing user when findByClerkId returns a user', async () => {
    const existing = makeUser('clerk_abc', 'a@b.com');
    const repo = makeMockRepo({ findByClerkId: vi.fn().mockResolvedValue(existing) });
    const service = new GetOrCreateUserService(repo);

    const result = await service.execute('clerk_abc', 'a@b.com');

    expect(result).toBe(existing);
    expect(repo.upsert).not.toHaveBeenCalled();
  });

  it('creates and returns a new user when findByClerkId returns null', async () => {
    const upserted = makeUser('clerk_new', 'new@example.com');
    const repo = makeMockRepo({
      findByClerkId: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockResolvedValue(upserted),
    });
    const service = new GetOrCreateUserService(repo);

    const result = await service.execute('clerk_new', 'new@example.com');

    expect(repo.upsert).toHaveBeenCalledOnce();
    expect(result).toBe(upserted);
  });

  it('propagates domain error when User.create() fails (invalid email)', async () => {
    const repo = makeMockRepo({ findByClerkId: vi.fn().mockResolvedValue(null) });
    const service = new GetOrCreateUserService(repo);

    await expect(service.execute('clerk_abc', 'not-an-email')).rejects.toThrow();
    expect(repo.upsert).not.toHaveBeenCalled();
  });

  it('propagates domain error when User.create() fails (empty clerkId)', async () => {
    const repo = makeMockRepo({ findByClerkId: vi.fn().mockResolvedValue(null) });
    const service = new GetOrCreateUserService(repo);

    await expect(service.execute('', 'valid@example.com')).rejects.toThrow();
  });
});
