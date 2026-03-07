import type { Request, RequestHandler } from 'express';
import type { AuthContext, AuthPort } from '../../ports/AuthPort';

export const MOCK_CLERK_USER_ID = 'mock_user_clerk_id';

export class MockAuthAdapter implements AuthPort {
  getAuthContext(_req: Request): AuthContext {
    return { clerkUserId: MOCK_CLERK_USER_ID };
  }

  requireAuthMiddleware(): RequestHandler {
    return (_req, _res, next) => next();
  }

  globalMiddleware(): RequestHandler {
    return (req, _res, next) => {
      // Attach a compatible auth object so code calling getAuthContext works
      (req as Request & { auth: AuthContext }).auth = { clerkUserId: MOCK_CLERK_USER_ID };
      next();
    };
  }
}
