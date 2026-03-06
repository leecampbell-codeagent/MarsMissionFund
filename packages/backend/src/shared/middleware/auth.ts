import { clerkMiddleware, getAuth } from '@clerk/express';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { AuthSyncService } from '../../account/application/auth-sync-service.js';
import {
  AccountDeactivatedError,
  AccountDeletedError,
  AccountPendingError,
  AccountSuspendedError,
} from '../../account/domain/errors.js';

// ---------------------------------------------------------------------------
// Correlation ID middleware
// ---------------------------------------------------------------------------

const CORRELATION_ID_PATTERN = /^[a-zA-Z0-9-]{1,128}$/;

export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.headers['x-request-id'];
  const incomingValue = Array.isArray(incoming) ? incoming[0] : incoming;

  let correlationId: string;
  if (incomingValue && CORRELATION_ID_PATTERN.test(incomingValue)) {
    correlationId = incomingValue;
  } else {
    correlationId = crypto.randomUUID();
  }

  req.correlationId = correlationId;
  res.setHeader('X-Request-Id', correlationId);
  next();
}

// ---------------------------------------------------------------------------
// Mock Clerk middleware (MOCK_AUTH=true)
// ---------------------------------------------------------------------------

function mockClerkMiddleware(req: Request, _res: Response, next: NextFunction): void {
  // Only inject mock user if an Authorization header is present (any non-empty value).
  // This preserves the 401 behaviour for unauthenticated requests in mock mode.
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.length > 0) {
    (req as Request & { _mockClerkUserId?: string })._mockClerkUserId = 'user_test_mock';
  }
  next();
}

// ---------------------------------------------------------------------------
// MMF auth middleware factory
// ---------------------------------------------------------------------------

export function createMmfAuthMiddleware(
  authSyncService: AuthSyncService,
  isMockAuth: boolean,
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      let clerkUserId: string | null | undefined;
      let emailFromJwt: string | null = null;

      const mockReq = req as Request & { _mockClerkUserId?: string };
      if (isMockAuth) {
        // In mock mode, never call getAuth() — real Clerk middleware is not mounted.
        // clerkUserId is the injected mock value, or null if no Authorization header.
        clerkUserId = mockReq._mockClerkUserId ?? null;
      } else {
        const auth = getAuth(req);
        clerkUserId = auth.userId;
        // Extract email from session claims (requires custom JWT template in Clerk Dashboard)
        const claims = auth.sessionClaims;
        if (claims && typeof claims.email === 'string') {
          emailFromJwt = claims.email;
        }
      }

      if (!clerkUserId) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required.',
            correlation_id: req.correlationId,
          },
        });
        return;
      }

      const user = await authSyncService.syncUser(clerkUserId, emailFromJwt);

      const status = user.accountStatus;
      if (status === 'suspended') {
        res.status(403).json({
          error: {
            code: 'ACCOUNT_SUSPENDED',
            message: 'Your account has been suspended.',
            correlation_id: req.correlationId,
          },
        });
        return;
      }
      if (status === 'deactivated') {
        res.status(403).json({
          error: {
            code: 'ACCOUNT_DEACTIVATED',
            message: 'Your account has been deactivated.',
            correlation_id: req.correlationId,
          },
        });
        return;
      }
      if (status === 'deleted') {
        res.status(403).json({
          error: {
            code: 'ACCOUNT_DELETED',
            message: 'This account no longer exists.',
            correlation_id: req.correlationId,
          },
        });
        return;
      }
      if (status === 'pending_verification') {
        res.status(403).json({
          error: {
            code: 'ACCOUNT_PENDING',
            message: 'Account verification required.',
            correlation_id: req.correlationId,
          },
        });
        return;
      }

      req.auth = {
        userId: user.id,
        clerkUserId: user.clerkUserId,
        email: user.email,
        roles: user.roles,
      };

      next();
    } catch (err) {
      if (
        err instanceof AccountSuspendedError ||
        err instanceof AccountDeactivatedError ||
        err instanceof AccountDeletedError ||
        err instanceof AccountPendingError
      ) {
        res.status(403).json({
          error: {
            code: err.code,
            message: err.message,
            correlation_id: req.correlationId,
          },
        });
        return;
      }
      next(err);
    }
  };
}

// ---------------------------------------------------------------------------
// Exported middleware builders
// ---------------------------------------------------------------------------

/**
 * Returns the appropriate Clerk middleware based on the isMockAuth flag.
 * Use this BEFORE mmfAuthMiddleware in server.ts.
 */
export function buildClerkMiddleware(isMockAuth: boolean): RequestHandler {
  if (isMockAuth) {
    return mockClerkMiddleware as RequestHandler;
  }
  return clerkMiddleware() as unknown as RequestHandler;
}
