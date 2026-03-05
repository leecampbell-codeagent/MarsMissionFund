import type { NextFunction, Request, Response } from 'express';
import type { AccountAppService } from '../../account/application/account-app-service.js';

export interface AuthClaimsExtractor {
  getUserId(req: Request): string | null;
  getEmail(req: Request): string;
  getDisplayName(req: Request): string | null;
}

/**
 * Creates middleware that looks up the MMF account by Clerk user ID,
 * creates via JIT if not found, checks account status, and attaches AuthContext to the request.
 */
export function createEnrichAuthContext(
  accountAppService: AccountAppService,
  claimsExtractor: AuthClaimsExtractor,
) {
  return async function enrichAuthContext(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const clerkUserId = claimsExtractor.getUserId(req);
    if (!clerkUserId) {
      // Should not happen if requireAuthentication middleware ran first
      res.status(401).json({
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Authentication required.',
          correlation_id: req.id,
        },
      });
      return;
    }

    const email = claimsExtractor.getEmail(req);
    const displayName = claimsExtractor.getDisplayName(req);

    const account = await accountAppService.findOrCreateAccount(clerkUserId, email, displayName);

    if (account.isSuspended()) {
      res.status(403).json({
        error: {
          code: 'ACCOUNT_SUSPENDED',
          message: 'Your account has been suspended. Please contact support.',
          correlation_id: req.id,
        },
      });
      return;
    }

    if (account.status === 'deleted') {
      res.status(403).json({
        error: {
          code: 'ACCOUNT_DELETED',
          message: 'This account has been deleted.',
          correlation_id: req.id,
        },
      });
      return;
    }

    req.authContext = {
      userId: account.id,
      clerkUserId: account.clerkUserId,
      email: account.email,
      displayName: account.displayName,
      roles: account.roles,
      accountStatus: account.status,
      onboardingCompleted: account.onboardingCompleted,
    };

    next();
  };
}
