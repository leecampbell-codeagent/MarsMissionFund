import { User } from '../domain/User';
import type { UserRepository } from '../ports/UserRepository';

export class GetOrCreateUserService {
  constructor(private readonly userRepo: UserRepository) {}

  async execute(clerkId: string, email: string): Promise<User> {
    const existing = await this.userRepo.findByClerkId(clerkId);
    if (existing) return existing;

    const result = User.create({ clerkId, email });
    if (result.isFailure) {
      throw result.error;
    }

    return await this.userRepo.upsert(result.value);
  }
}
