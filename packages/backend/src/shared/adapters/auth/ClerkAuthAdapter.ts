import { clerkMiddleware, getAuth, requireAuth } from '@clerk/express';
import type { Request, RequestHandler } from 'express';
import type { AuthContext, AuthPort } from '../../ports/AuthPort';

export class ClerkAuthAdapter implements AuthPort {
  getAuthContext(req: Request): AuthContext | null {
    const auth = getAuth(req);
    if (!auth.userId) return null;
    return { clerkUserId: auth.userId };
  }

  requireAuthMiddleware(): RequestHandler {
    return requireAuth();
  }

  globalMiddleware(): RequestHandler {
    return clerkMiddleware();
  }
}
