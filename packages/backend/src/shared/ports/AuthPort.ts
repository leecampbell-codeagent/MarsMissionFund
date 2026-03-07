import type { Request, RequestHandler } from 'express';

export interface AuthContext {
  clerkUserId: string;
}

export interface AuthPort {
  /**
   * Extracts auth context from an Express request after middleware has run.
   * Returns null if not authenticated.
   */
  getAuthContext(req: Request): AuthContext | null;

  /**
   * Returns an Express middleware that rejects unauthenticated requests with 401.
   */
  requireAuthMiddleware(): RequestHandler;

  /**
   * Returns an Express middleware that populates auth context on the request.
   * Does NOT reject unauthenticated requests.
   */
  globalMiddleware(): RequestHandler;
}
