import { describe, expect, it, vi } from 'vitest';
import { InvalidRoleError } from '../domain/errors/InvalidRoleError';
import { RoleAssignmentForbiddenError } from '../domain/errors/RoleAssignmentForbiddenError';
import { SuperAdminAssignmentRestrictedError } from '../domain/errors/SuperAdminAssignmentRestrictedError';
import { UserNotFoundError } from '../domain/errors/UserNotFoundError';
import { KycStatus } from '../domain/KycStatus';
import { Role } from '../domain/Role';
import { User } from '../domain/User';
import type { UserRepository } from '../ports/UserRepository';
import { AssignRolesService } from './AssignRolesService';

function makeUser(roles: Role[], id = 'uuid-1'): User {
  return User.reconstitute({
    id,
    clerkId: 'clerk_1',
    email: 'test@example.com',
    displayName: null,
    avatarUrl: null,
    bio: null,
    roles,
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
    upsert: vi.fn(),
    updateProfile: vi.fn().mockResolvedValue(null),
    updateRoles: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

describe('AssignRolesService', () => {
  it('throws RoleAssignmentForbiddenError when actor does not have Administrator role', async () => {
    const actor = makeUser([Role.Backer]);
    const repo = makeMockRepo();
    const service = new AssignRolesService(repo);

    await expect(service.execute(actor, 'target-uuid', [Role.Creator])).rejects.toThrow(
      RoleAssignmentForbiddenError,
    );
    expect(repo.updateRoles).not.toHaveBeenCalled();
  });

  it('throws RoleAssignmentForbiddenError when actor is Reviewer but not Administrator', async () => {
    const actor = makeUser([Role.Reviewer]);
    const repo = makeMockRepo();
    const service = new AssignRolesService(repo);

    await expect(service.execute(actor, 'target-uuid', [Role.Backer])).rejects.toThrow(
      RoleAssignmentForbiddenError,
    );
  });

  it('throws InvalidRoleError for an unrecognised role string', async () => {
    const actor = makeUser([Role.Administrator]);
    const repo = makeMockRepo();
    const service = new AssignRolesService(repo);

    await expect(service.execute(actor, 'target-uuid', ['dragon_master'])).rejects.toThrow(
      InvalidRoleError,
    );
  });

  it('throws SuperAdminAssignmentRestrictedError when super_administrator is in roles list', async () => {
    const actor = makeUser([Role.Administrator]);
    const repo = makeMockRepo();
    const service = new AssignRolesService(repo);

    await expect(service.execute(actor, 'target-uuid', [Role.SuperAdministrator])).rejects.toThrow(
      SuperAdminAssignmentRestrictedError,
    );
  });

  it('updates roles successfully when actor is Administrator and roles are valid', async () => {
    const actor = makeUser([Role.Administrator]);
    const _targetUser = makeUser([Role.Backer], 'target-uuid');
    const updatedUser = makeUser([Role.Creator], 'target-uuid');
    const repo = makeMockRepo({
      updateRoles: vi.fn().mockResolvedValue(updatedUser),
    });
    const service = new AssignRolesService(repo);

    const result = await service.execute(actor, 'target-uuid', [Role.Creator]);

    expect(repo.updateRoles).toHaveBeenCalledWith('target-uuid', [Role.Creator]);
    expect(result).toBe(updatedUser);
  });

  it('throws UserNotFoundError when target user does not exist', async () => {
    const actor = makeUser([Role.Administrator]);
    const repo = makeMockRepo({
      updateRoles: vi.fn().mockResolvedValue(null),
    });
    const service = new AssignRolesService(repo);

    await expect(service.execute(actor, 'nonexistent-uuid', [Role.Backer])).rejects.toThrow(
      UserNotFoundError,
    );
  });
});
