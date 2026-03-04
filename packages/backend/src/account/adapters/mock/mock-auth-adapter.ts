import type { RequestHandler, Request, Response, NextFunction } from 'express';
import type { AuthPort, AuthPayload } from '../../ports/auth-port.js';

const MOCK_USER_ID = 'user_mock_001';
const MOCK_SESSION_ID = 'sess_mock_001';

export class MockAuthAdapter implements AuthPort {
  async verifyToken(_token: string): Promise<AuthPayload | null> {
    return {
      clerkUserId: MOCK_USER_ID,
      sessionId: MOCK_SESSION_ID,
    };
  }

  getMiddleware(): RequestHandler {
    return (req: Request, _res: Response, next: NextFunction): void => {
      // Attach a mock auth object that mimics Clerk's auth structure
      (req as unknown as Record<string, unknown>)['auth'] = {
        userId: MOCK_USER_ID,
        sessionId: MOCK_SESSION_ID,
        sessionClaims: {
          email: 'mock@example.com',
          firstName: 'Mock',
          lastName: 'User',
        },
      };
      next();
    };
  }
}

export { MOCK_USER_ID, MOCK_SESSION_ID };
