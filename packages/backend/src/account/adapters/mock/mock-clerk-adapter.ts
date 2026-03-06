import type { ClerkPort, ClerkUserInfo } from '../../ports/clerk-port.js';

export class MockClerkAdapter implements ClerkPort {
  async getUser(clerkUserId: string): Promise<ClerkUserInfo> {
    if (clerkUserId === 'user_test_mock') {
      return {
        email: 'test@marsmissionfund.test',
        firstName: 'Test',
      };
    }
    return {
      email: 'unknown@marsmissionfund.test',
    };
  }
}
