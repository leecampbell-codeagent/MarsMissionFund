import { createClerkClient } from '@clerk/express';
import type { ClerkPort, ClerkUserInfo } from '../../ports/clerk-port.js';

export class ClerkAdapter implements ClerkPort {
  private readonly clerkClient = createClerkClient({
    secretKey: process.env.CLERK_SECRET_KEY,
  });

  async getUser(clerkUserId: string): Promise<ClerkUserInfo> {
    const user = await this.clerkClient.users.getUser(clerkUserId);
    const primaryEmailId = user.primaryEmailAddressId;
    const emailAddress = user.emailAddresses.find((e) => e.id === primaryEmailId);
    const email = emailAddress?.emailAddress ?? '';
    if (!email) {
      throw new Error(`No primary email address found for Clerk user ${clerkUserId}`);
    }
    return {
      email,
      firstName: user.firstName ?? undefined,
    };
  }
}
