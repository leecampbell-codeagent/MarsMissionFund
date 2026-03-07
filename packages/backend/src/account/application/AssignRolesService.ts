import { InvalidRoleError } from '../domain/errors/InvalidRoleError';
import { RoleAssignmentForbiddenError } from '../domain/errors/RoleAssignmentForbiddenError';
import { SuperAdminAssignmentRestrictedError } from '../domain/errors/SuperAdminAssignmentRestrictedError';
import { UserNotFoundError } from '../domain/errors/UserNotFoundError';
import { ALL_ROLES, Role } from '../domain/Role';
import type { User } from '../domain/User';
import type { UserRepository } from '../ports/UserRepository';

export class AssignRolesService {
  constructor(private readonly userRepo: UserRepository) {}

  async execute(actorUser: User, targetUserId: string, newRoles: string[]): Promise<User> {
    // 1. Actor must have Administrator role
    if (!actorUser.hasRole(Role.Administrator)) {
      throw new RoleAssignmentForbiddenError();
    }

    // 2. Validate all requested roles are known values
    for (const role of newRoles) {
      if (!ALL_ROLES.includes(role as Role)) {
        throw new InvalidRoleError(role);
      }
    }

    // 3. Super Administrator cannot be assigned through this endpoint (AC-ACCT-014)
    if (newRoles.includes(Role.SuperAdministrator)) {
      throw new SuperAdminAssignmentRestrictedError();
    }

    // 4. Apply role update
    const updated = await this.userRepo.updateRoles(targetUserId, newRoles);
    if (!updated) throw new UserNotFoundError();
    return updated;
  }
}
