import type { User } from '../domain/models/user.js';
import type { ClerkPort } from '../ports/clerk-port.js';
import type { UserRepository } from '../ports/user-repository.js';

export class AuthSyncService {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly clerkPort: ClerkPort,
  ) {}

  async syncUser(clerkUserId: string, emailFromJwt: string | null): Promise<User> {
    // Fast path: user already exists
    const existing = await this.userRepo.findByClerkId(clerkUserId);
    if (existing) {
      return existing;
    }

    // New user: resolve email
    let email: string;
    if (emailFromJwt !== null && emailFromJwt !== '') {
      email = emailFromJwt;
    } else {
      const clerkUser = await this.clerkPort.getUser(clerkUserId);
      email = clerkUser.email;
    }

    const id = crypto.randomUUID();
    return this.userRepo.upsertWithBackerRole({ id, clerkUserId, email });
  }
}
