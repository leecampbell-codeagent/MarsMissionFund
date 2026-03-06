import type { User } from '../domain/models/user.js';

export interface UserSyncInput {
  readonly id: string;
  readonly clerkUserId: string;
  readonly email: string;
}

export interface UserRepository {
  findByClerkId(clerkUserId: string): Promise<User | null>;
  upsertWithBackerRole(input: UserSyncInput): Promise<User>;
  findById(userId: string): Promise<User | null>;
}
