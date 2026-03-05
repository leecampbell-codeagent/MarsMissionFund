import type { NextFunction, Request, Response } from 'express';

export interface AuthExtractor {
  getUserId(req: Request): string | null;
}

/**
 * Creates a middleware that checks for a valid authenticated user.
 * Returns 401 if no authenticated user is found.
 */
export function createRequireAuthentication(authExtractor: AuthExtractor) {
  return function requireAuthentication(req: Request, res: Response, next: NextFunction): void {
    const userId = authExtractor.getUserId(req);
    if (!userId) {
      res.status(401).json({
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Authentication required.',
          correlation_id: req.id,
        },
      });
      return;
    }
    next();
  };
}
