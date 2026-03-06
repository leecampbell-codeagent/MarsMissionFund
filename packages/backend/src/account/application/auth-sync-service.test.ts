import { describe, expect, it, vi } from 'vitest';
import { User } from '../domain/models/user.js';
import type { ClerkPort } from '../ports/clerk-port.js';
import type { UserRepository } from '../ports/user-repository.js';
import { AuthSyncService } from './auth-sync-service.js';

function makeUser(id = '550e8400-e29b-41d4-a716-446655440001'): User {
  return User.reconstitute(
    {
      id,
      clerkUserId: 'user_abc123',
      email: 'alice@example.com',
      displayName: null,
      avatarUrl: null,
      accountStatus: 'active',
      onboardingCompleted: false,
      createdAt: new Date('2026-03-06T00:00:00Z'),
      updatedAt: new Date('2026-03-06T00:00:00Z'),
    },
    ['backer'],
  );
}

function makeRepo(overrides: Partial<UserRepository> = {}): UserRepository {
  return {
    findByClerkId: vi.fn().mockResolvedValue(null),
    upsertWithBackerRole: vi.fn().mockResolvedValue(makeUser()),
    findById: vi.fn().mockResolvedValue(makeUser()),
    ...overrides,
  };
}

function makeClerkPort(overrides: Partial<ClerkPort> = {}): ClerkPort {
  return {
    getUser: vi.fn().mockResolvedValue({ email: 'alice@example.com', firstName: 'Alice' }),
    ...overrides,
  };
}

describe('AuthSyncService', () => {
  it('returns existing user when findByClerkId returns a user (no upsert called)', async () => {
    const existingUser = makeUser();
    const repo = makeRepo({ findByClerkId: vi.fn().mockResolvedValue(existingUser) });
    const clerkPort = makeClerkPort();
    const service = new AuthSyncService(repo, clerkPort);

    const result = await service.syncUser('user_abc123', 'alice@example.com');

    expect(result).toBe(existingUser);
    expect(repo.upsertWithBackerRole).not.toHaveBeenCalled();
    expect(clerkPort.getUser).not.toHaveBeenCalled();
  });

  it('calls upsertWithBackerRole when findByClerkId returns null', async () => {
    const newUser = makeUser();
    const repo = makeRepo({
      findByClerkId: vi.fn().mockResolvedValue(null),
      upsertWithBackerRole: vi.fn().mockResolvedValue(newUser),
    });
    const clerkPort = makeClerkPort();
    const service = new AuthSyncService(repo, clerkPort);

    const result = await service.syncUser('user_abc123', 'alice@example.com');

    expect(result).toBe(newUser);
    expect(repo.upsertWithBackerRole).toHaveBeenCalledOnce();
  });

  it('uses email from JWT claim when provided (no ClerkPort.getUser call)', async () => {
    const repo = makeRepo();
    const clerkPort = makeClerkPort();
    const service = new AuthSyncService(repo, clerkPort);

    await service.syncUser('user_abc123', 'from-jwt@example.com');

    expect(clerkPort.getUser).not.toHaveBeenCalled();
    expect(repo.upsertWithBackerRole).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'from-jwt@example.com' }),
    );
  });

  it('falls back to ClerkPort.getUser when JWT email claim is null', async () => {
    const repo = makeRepo();
    const clerkPort = makeClerkPort({
      getUser: vi.fn().mockResolvedValue({ email: 'fromclerk@example.com' }),
    });
    const service = new AuthSyncService(repo, clerkPort);

    await service.syncUser('user_abc123', null);

    expect(clerkPort.getUser).toHaveBeenCalledWith('user_abc123');
    expect(repo.upsertWithBackerRole).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'fromclerk@example.com' }),
    );
  });

  it('falls back to ClerkPort.getUser when JWT email claim is empty string', async () => {
    const repo = makeRepo();
    const clerkPort = makeClerkPort({
      getUser: vi.fn().mockResolvedValue({ email: 'fromclerk@example.com' }),
    });
    const service = new AuthSyncService(repo, clerkPort);

    await service.syncUser('user_abc123', '');

    expect(clerkPort.getUser).toHaveBeenCalledWith('user_abc123');
  });

  it('propagates error when ClerkPort.getUser throws', async () => {
    const repo = makeRepo();
    const clerkPort = makeClerkPort({
      getUser: vi.fn().mockRejectedValue(new Error('Clerk API unavailable')),
    });
    const service = new AuthSyncService(repo, clerkPort);

    await expect(service.syncUser('user_abc123', null)).rejects.toThrow('Clerk API unavailable');
  });

  it('propagates error when upsertWithBackerRole throws', async () => {
    const repo = makeRepo({
      upsertWithBackerRole: vi.fn().mockRejectedValue(new Error('DB error')),
    });
    const clerkPort = makeClerkPort();
    const service = new AuthSyncService(repo, clerkPort);

    await expect(service.syncUser('user_abc123', 'alice@example.com')).rejects.toThrow('DB error');
  });

  it('generates different UUID for id on each upsert call', async () => {
    const ids: string[] = [];
    const repo: UserRepository = {
      findByClerkId: vi.fn().mockResolvedValue(null),
      findById: vi.fn().mockResolvedValue(makeUser()),
      upsertWithBackerRole: vi.fn().mockImplementation(async (input: { id: string }) => {
        ids.push(input.id);
        return makeUser(input.id);
      }),
    };
    const clerkPort = makeClerkPort();
    const service = new AuthSyncService(repo, clerkPort);

    await service.syncUser('user_abc123', 'alice@example.com');
    (repo.findByClerkId as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    await service.syncUser('user_xyz789', 'bob@example.com');

    expect(ids).toHaveLength(2);
    expect(ids[0]).not.toBe(ids[1]);
  });
});
