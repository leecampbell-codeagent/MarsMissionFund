import { clerkMiddleware, getAuth } from '@clerk/express';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

export { clerkMiddleware };

/**
 * requireAuth middleware configured to return JSON 401 instead of redirecting.
 * Per gotcha G-003 — Clerk's default requireAuth redirects to a sign-in page.
 * WARN-002: error response includes correlation_id field.
 * Uses getAuth() manually since @clerk/express requireAuth() doesn't support unauthorizedHandler.
 */
export function createRequireAuth(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const auth = getAuth(req);
    if (!auth.userId) {
      res.status(401).json({
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Authentication required. Sign in to continue.',
          correlation_id: req.correlationId ?? null,
        },
      });
      return;
    }
    next();
  };
}

/**
 * Middleware to inject a correlation ID on each request.
 */
export function correlationIdMiddleware(req: Request, _res: Response, next: NextFunction): void {
  req.correlationId = crypto.randomUUID();
  next();
}

/**
 * Helper to extract clerk auth from the request.
 */
export function getClerkAuth(req: Request): { userId: string } | null {
  const auth = getAuth(req);
  if (!auth.userId) return null;
  return { userId: auth.userId };
}
