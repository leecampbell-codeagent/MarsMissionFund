import { UserNotFoundError } from '../domain/errors/UserNotFoundError';
import type { User } from '../domain/User';
import type { UserRepository } from '../ports/UserRepository';

export class UpdateUserProfileService {
  constructor(private readonly userRepo: UserRepository) {}

  async execute(
    userId: string,
    fields: { displayName?: string | null; bio?: string | null; avatarUrl?: string | null },
  ): Promise<User> {
    const updated = await this.userRepo.updateProfile(userId, fields);
    if (!updated) throw new UserNotFoundError();
    return updated;
  }
}
