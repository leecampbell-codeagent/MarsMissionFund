import type { User } from '../domain/User';

export interface UserRepository {
  findByClerkId(clerkId: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  upsert(user: User): Promise<User>;
  updateProfile(
    id: string,
    fields: { displayName?: string | null; bio?: string | null; avatarUrl?: string | null },
  ): Promise<User | null>;
  updateRoles(id: string, roles: string[]): Promise<User | null>;
}
