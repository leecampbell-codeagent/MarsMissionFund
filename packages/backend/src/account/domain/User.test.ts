import { describe, expect, it } from 'vitest';
import { KycStatus } from './KycStatus';
import { Role } from './Role';
import { User } from './User';

describe('User.create()', () => {
  it('returns a Result.ok with default backer role, not_verified kyc_status, onboardingCompleted: false', () => {
    const result = User.create({ clerkId: 'clerk_abc123', email: 'test@example.com' });

    expect(result.isSuccess).toBe(true);
    const user = result.value;
    expect(user.clerkId).toBe('clerk_abc123');
    expect(user.email).toBe('test@example.com');
    expect(user.roles).toEqual([Role.Backer]);
    expect(user.kycStatus).toBe(KycStatus.NotVerified);
    expect(user.onboardingCompleted).toBe(false);
    expect(user.displayName).toBeNull();
    expect(user.avatarUrl).toBeNull();
    expect(user.bio).toBeNull();
    expect(user.id).toBeTruthy();
    expect(user.createdAt).toBeInstanceOf(Date);
    expect(user.updatedAt).toBeInstanceOf(Date);
  });

  it('accepts optional displayName, avatarUrl, bio', () => {
    const result = User.create({
      clerkId: 'clerk_abc123',
      email: 'test@example.com',
      displayName: 'Ada Lovelace',
      avatarUrl: 'https://example.com/avatar.jpg',
      bio: 'Pioneer of computing',
    });

    expect(result.isSuccess).toBe(true);
    const user = result.value;
    expect(user.displayName).toBe('Ada Lovelace');
    expect(user.avatarUrl).toBe('https://example.com/avatar.jpg');
    expect(user.bio).toBe('Pioneer of computing');
  });

  it('returns Result.fail when clerkId is empty string', () => {
    const result = User.create({ clerkId: '', email: 'test@example.com' });
    expect(result.isFailure).toBe(true);
    expect(result.error?.message).toContain('clerkId');
  });

  it('returns Result.fail when clerkId is whitespace-only', () => {
    const result = User.create({ clerkId: '   ', email: 'test@example.com' });
    expect(result.isFailure).toBe(true);
    expect(result.error?.message).toContain('clerkId');
  });

  it('returns Result.fail when email is invalid (no @)', () => {
    const result = User.create({ clerkId: 'clerk_abc123', email: 'notanemail' });
    expect(result.isFailure).toBe(true);
    expect(result.error?.message).toContain('email');
  });

  it('returns Result.fail when email is empty string', () => {
    const result = User.create({ clerkId: 'clerk_abc123', email: '' });
    expect(result.isFailure).toBe(true);
    expect(result.error?.message).toContain('email');
  });

  it('never throws — always returns a Result', () => {
    expect(() => User.create({ clerkId: '', email: '' })).not.toThrow();
  });
});

describe('User.reconstitute()', () => {
  it('returns a User without validation — accepts any inputs', () => {
    const now = new Date();
    const user = User.reconstitute({
      id: 'some-uuid',
      clerkId: 'clerk_xyz',
      email: 'user@domain.com',
      displayName: 'Test User',
      avatarUrl: null,
      bio: null,
      roles: [Role.Creator, Role.Reviewer],
      kycStatus: KycStatus.Verified,
      onboardingCompleted: true,
      createdAt: now,
      updatedAt: now,
    });

    expect(user.id).toBe('some-uuid');
    expect(user.clerkId).toBe('clerk_xyz');
    expect(user.roles).toEqual([Role.Creator, Role.Reviewer]);
    expect(user.kycStatus).toBe(KycStatus.Verified);
    expect(user.onboardingCompleted).toBe(true);
  });
});

describe('User.hasRole()', () => {
  it('returns true for an assigned role', () => {
    const user = User.reconstitute({
      id: 'id-1',
      clerkId: 'clerk_1',
      email: 'a@b.com',
      displayName: null,
      avatarUrl: null,
      bio: null,
      roles: [Role.Backer, Role.Creator],
      kycStatus: KycStatus.NotVerified,
      onboardingCompleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    expect(user.hasRole(Role.Backer)).toBe(true);
    expect(user.hasRole(Role.Creator)).toBe(true);
  });

  it('returns false for an unassigned role', () => {
    const user = User.reconstitute({
      id: 'id-1',
      clerkId: 'clerk_1',
      email: 'a@b.com',
      displayName: null,
      avatarUrl: null,
      bio: null,
      roles: [Role.Backer],
      kycStatus: KycStatus.NotVerified,
      onboardingCompleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    expect(user.hasRole(Role.Administrator)).toBe(false);
    expect(user.hasRole(Role.Reviewer)).toBe(false);
  });
});

describe('User.isAdmin()', () => {
  const makeUser = (roles: (typeof Role)[keyof typeof Role][]) =>
    User.reconstitute({
      id: 'id-1',
      clerkId: 'clerk_1',
      email: 'a@b.com',
      displayName: null,
      avatarUrl: null,
      bio: null,
      roles,
      kycStatus: KycStatus.NotVerified,
      onboardingCompleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

  it('returns true for Reviewer', () => {
    expect(makeUser([Role.Reviewer]).isAdmin()).toBe(true);
  });

  it('returns true for Administrator', () => {
    expect(makeUser([Role.Administrator]).isAdmin()).toBe(true);
  });

  it('returns true for SuperAdministrator', () => {
    expect(makeUser([Role.SuperAdministrator]).isAdmin()).toBe(true);
  });

  it('returns false for Backer', () => {
    expect(makeUser([Role.Backer]).isAdmin()).toBe(false);
  });

  it('returns false for Creator', () => {
    expect(makeUser([Role.Creator]).isAdmin()).toBe(false);
  });
});
