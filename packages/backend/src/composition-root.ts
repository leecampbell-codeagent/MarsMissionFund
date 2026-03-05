import type { Request } from 'express';
import { InMemoryAccountRepository } from './account/adapters/mock/in-memory-account-repository.js';
import { MockAuthAdapter } from './account/adapters/mock/mock-auth-adapter.js';
import { MockWebhookVerificationAdapter } from './account/adapters/mock/mock-webhook-verification-adapter.js';
import { AccountAppService } from './account/application/account-app-service.js';
import type { AppDependencies } from './app.js';
import { logger } from './logger.js';
import type { AuthClaimsExtractor } from './shared/middleware/enrich-auth-context.js';
import type { AuthExtractor } from './shared/middleware/require-authentication.js';

interface MockAuth {
  userId?: string;
  sessionClaims?: {
    email?: string;
    firstName?: string;
    lastName?: string;
  };
}

function getAuthFromRequest(req: Request): MockAuth | undefined {
  return (req as unknown as Record<string, unknown>).auth as MockAuth | undefined;
}

/**
 * Creates mock auth extractor that reads from req.auth set by MockAuthAdapter.
 */
function createMockAuthExtractor(): AuthExtractor & AuthClaimsExtractor {
  return {
    getUserId(req: Request): string | null {
      const auth = getAuthFromRequest(req);
      return auth?.userId ?? null;
    },
    getEmail(req: Request): string {
      const auth = getAuthFromRequest(req);
      return auth?.sessionClaims?.email ?? 'unknown@example.com';
    },
    getDisplayName(req: Request): string | null {
      const auth = getAuthFromRequest(req);
      const first = auth?.sessionClaims?.firstName ?? '';
      const last = auth?.sessionClaims?.lastName ?? '';
      const name = [first, last].filter(Boolean).join(' ');
      return name || null;
    },
  };
}

/**
 * Creates Clerk auth extractor that reads from req via getAuth().
 * Only imported when MOCK_AUTH is not true.
 */
async function createClerkAuthExtractor(): Promise<AuthExtractor & AuthClaimsExtractor> {
  const { getAuth } = await import('@clerk/express');
  return {
    getUserId(req: Request): string | null {
      const auth = getAuth(req);
      return auth.userId ?? null;
    },
    getEmail(req: Request): string {
      const auth = getAuth(req);
      const claims = auth.sessionClaims as Record<string, unknown> | undefined;
      if (claims && typeof claims.email === 'string') {
        return claims.email;
      }
      return 'unknown@example.com';
    },
    getDisplayName(req: Request): string | null {
      const auth = getAuth(req);
      const claims = auth.sessionClaims as Record<string, unknown> | undefined;
      if (!claims) return null;
      const first = typeof claims.firstName === 'string' ? claims.firstName : '';
      const last = typeof claims.lastName === 'string' ? claims.lastName : '';
      const name = [first, last].filter(Boolean).join(' ');
      return name || null;
    },
  };
}

export async function createDependencies(): Promise<AppDependencies> {
  const isMockAuth = process.env.MOCK_AUTH === 'true';

  if (isMockAuth) {
    logger.info('Using mock auth adapters (MOCK_AUTH=true)');

    const authPort = new MockAuthAdapter();
    const webhookVerifier = new MockWebhookVerificationAdapter();
    const accountRepository = new InMemoryAccountRepository();
    const accountAppService = new AccountAppService(accountRepository, logger);
    const extractor = createMockAuthExtractor();

    return {
      authPort,
      webhookVerifier,
      accountAppService,
      authExtractor: extractor,
      claimsExtractor: extractor,
    };
  }

  // Production mode: use Clerk and PostgreSQL
  logger.info('Using Clerk auth adapters');

  const clerkSecretKey = process.env.CLERK_SECRET_KEY;
  if (!clerkSecretKey) {
    throw new Error('CLERK_SECRET_KEY is required when MOCK_AUTH is not true');
  }

  const webhookSigningSecret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;
  if (!webhookSigningSecret) {
    throw new Error('CLERK_WEBHOOK_SIGNING_SECRET is required when MOCK_AUTH is not true');
  }

  const { ClerkAuthAdapter } = await import('./account/adapters/clerk/clerk-auth-adapter.js');
  const { ClerkWebhookVerificationAdapter } = await import(
    './account/adapters/clerk/clerk-webhook-verification-adapter.js'
  );
  const { PgAccountRepository } = await import('./account/adapters/pg/pg-account-repository.js');
  const { Pool } = await import('pg');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const authPort = new ClerkAuthAdapter();
  const webhookVerifier = new ClerkWebhookVerificationAdapter(webhookSigningSecret);
  const accountRepository = new PgAccountRepository(pool);
  const accountAppService = new AccountAppService(accountRepository, logger);
  const extractor = await createClerkAuthExtractor();

  return {
    authPort,
    webhookVerifier,
    accountAppService,
    authExtractor: extractor,
    claimsExtractor: extractor,
  };
}
