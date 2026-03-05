import { UserNotFoundError } from '../domain/errors/account-errors.js';
import type { ClerkAuthPort, ClerkUserMetadata } from '../ports/clerk-auth.port.js';

// Fixed test fixtures per spec
const MOCK_USERS: Record<string, ClerkUserMetadata> = {
  user_test_backer: {
    clerkUserId: 'user_test_backer',
    email: 'backer@test.mmf',
    emailVerified: true,
    firstName: 'Test',
    lastName: 'Backer',
  },
  user_test_unverified: {
    clerkUserId: 'user_test_unverified',
    email: 'unverified@test.mmf',
    emailVerified: false,
    firstName: null,
    lastName: null,
  },
  user_test_admin: {
    clerkUserId: 'user_test_admin',
    email: 'admin@test.mmf',
    emailVerified: true,
    firstName: 'Test',
    lastName: 'Admin',
  },
};

export class MockClerkAuthAdapter implements ClerkAuthPort {
  readonly metadataUpdates: Array<{ clerkUserId: string; metadata: { role: string } }> = [];

  async getUserMetadata(clerkUserId: string): Promise<ClerkUserMetadata> {
    const user = MOCK_USERS[clerkUserId];
    if (!user) {
      throw new UserNotFoundError(clerkUserId);
    }
    return user;
  }

  async setPublicMetadata(clerkUserId: string, metadata: { role: string }): Promise<void> {
    this.metadataUpdates.push({ clerkUserId, metadata });
    // No-op in tests
  }
}
