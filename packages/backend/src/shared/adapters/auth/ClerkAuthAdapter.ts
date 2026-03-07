import { clerkMiddleware, getAuth } from '@clerk/express';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { AuthContext, AuthPort } from '../../ports/AuthPort';

export class ClerkAuthAdapter implements AuthPort {
  getAuthContext(req: Request): AuthContext | null {
    const auth = getAuth(req);
    if (!auth.userId) return null;
    return { clerkUserId: auth.userId };
  }

  requireAuthMiddleware(): RequestHandler {
    return (req: Request, res: Response, next: NextFunction): void => {
      const auth = getAuth(req);
      if (!auth.userId) {
        res
          .status(401)
          .json({ error: { code: 'UNAUTHORISED', message: 'Authentication required' } });
        return;
      }
      next();
    };
  }

  globalMiddleware(): RequestHandler {
    return clerkMiddleware();
  }
}
