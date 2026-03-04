import { clerkMiddleware, getAuth } from '@clerk/express';
import type { RequestHandler, Request } from 'express';
import type { AuthPort, AuthPayload } from '../../ports/auth-port.js';

export class ClerkAuthAdapter implements AuthPort {
  async verifyToken(token: string): Promise<AuthPayload | null> {
    // In the Clerk Express SDK, token verification is handled by the middleware.
    // This method is provided for programmatic verification outside of middleware context.
    // For request-based flows, use getMiddleware() + getAuth(req).
    // Direct token verification would require clerkClient which needs CLERK_SECRET_KEY.
    // For now, return null as token verification is handled by the middleware pipeline.
    void token;
    return null;
  }

  getMiddleware(): RequestHandler {
    return clerkMiddleware() as unknown as RequestHandler;
  }
}

/**
 * Extracts the Clerk auth userId from a request that has been processed by clerkMiddleware().
 * Returns the userId string or null if not authenticated.
 */
export function getClerkUserId(req: Request): string | null {
  const auth = getAuth(req);
  return auth.userId ?? null;
}

/**
 * Extracts session claims from a request processed by clerkMiddleware().
 */
export function getClerkSessionClaims(req: Request): { email?: string; firstName?: string; lastName?: string } {
  const auth = getAuth(req);
  const claims = auth.sessionClaims as Record<string, unknown> | undefined;
  if (!claims) {
    return {};
  }
  return {
    email: typeof claims['email'] === 'string' ? claims['email'] : undefined,
    firstName: typeof claims['firstName'] === 'string' ? claims['firstName'] : undefined,
    lastName: typeof claims['lastName'] === 'string' ? claims['lastName'] : undefined,
  };
}
