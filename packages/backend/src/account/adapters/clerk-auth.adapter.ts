import { clerkClient } from '@clerk/express';
import { UserNotFoundError } from '../domain/errors/account-errors.js';
import type { ClerkAuthPort, ClerkUserMetadata } from '../ports/clerk-auth.port.js';

export class ClerkAuthAdapter implements ClerkAuthPort {
  async getUserMetadata(clerkUserId: string): Promise<ClerkUserMetadata> {
    try {
      const user = await clerkClient.users.getUser(clerkUserId);

      const primaryEmail = user.emailAddresses.find((ea) => ea.id === user.primaryEmailAddressId);

      if (!primaryEmail) {
        throw new UserNotFoundError(clerkUserId);
      }

      return {
        clerkUserId: user.id,
        email: primaryEmail.emailAddress,
        emailVerified: primaryEmail.verification?.status === 'verified',
        firstName: user.firstName ?? null,
        lastName: user.lastName ?? null,
      };
    } catch (err) {
      if (err instanceof UserNotFoundError) throw err;
      throw new UserNotFoundError(clerkUserId);
    }
  }

  async setPublicMetadata(clerkUserId: string, metadata: { role: string }): Promise<void> {
    await clerkClient.users.updateUserMetadata(clerkUserId, {
      publicMetadata: metadata,
    });
  }
}
