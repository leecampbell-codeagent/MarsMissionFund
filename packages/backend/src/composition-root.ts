import type { Request } from 'express';
import { InMemoryAccountRepository } from './account/adapters/mock/in-memory-account-repository.js';
import { MockAuthAdapter } from './account/adapters/mock/mock-auth-adapter.js';
import { MockWebhookVerificationAdapter } from './account/adapters/mock/mock-webhook-verification-adapter.js';
import { AccountAppService } from './account/application/account-app-service.js';
import type { AppDependencies } from './app.js';
import { InMemoryCampaignRepository } from './campaign/adapters/mock/in-memory-campaign-repository.js';
import { MockKycStatusAdapter } from './campaign/adapters/mock/mock-kyc-status-adapter.js';
import { CampaignAppService } from './campaign/application/campaign-app-service.js';
import { InMemoryKycRepository } from './kyc/adapters/mock/in-memory-kyc-repository.js';
import { MockKycAdapter } from './kyc/adapters/mock/mock-kyc-adapter.js';
import { KycAppService } from './kyc/application/kyc-app-service.js';
import { logger } from './logger.js';
import { InMemoryEventStore } from './shared/adapters/mock/in-memory-event-store.js';
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
    const eventStore = new InMemoryEventStore();
    const accountAppService = new AccountAppService(accountRepository, eventStore, logger);
    const kycRepository = new InMemoryKycRepository();
    const kycAdapter = new MockKycAdapter();
    const isMockKyc = process.env.MOCK_KYC !== 'false';
    const kycAppService = new KycAppService(
      kycRepository,
      accountRepository,
      kycAdapter,
      eventStore,
      logger,
      isMockKyc,
    );
    const extractor = createMockAuthExtractor();

    const campaignRepository = new InMemoryCampaignRepository();
    const kycStatusAdapter = new MockKycStatusAdapter();
    const campaignAppService = new CampaignAppService(
      campaignRepository,
      kycStatusAdapter,
      eventStore,
      logger,
    );

    return {
      authPort,
      webhookVerifier,
      accountAppService,
      kycAppService,
      campaignAppService,
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
  const { PgEventStoreAdapter, PgTransactionAdapter } = await import(
    './shared/adapters/pg/pg-event-store-adapter.js'
  );
  const { Pool } = await import('pg');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const { PgKycRepository } = await import('./kyc/adapters/pg/pg-kyc-repository.js');
  const { PgCampaignRepository } = await import('./campaign/adapters/pg/pg-campaign-repository.js');
  const { PgKycStatusAdapter } = await import('./campaign/adapters/pg/pg-kyc-status-adapter.js');

  const authPort = new ClerkAuthAdapter();
  const webhookVerifier = new ClerkWebhookVerificationAdapter(webhookSigningSecret);
  const accountRepository = new PgAccountRepository(pool);
  const eventStore = new PgEventStoreAdapter(pool);
  const transactionPort = new PgTransactionAdapter(pool);
  const accountAppService = new AccountAppService(
    accountRepository,
    eventStore,
    logger,
    transactionPort,
  );

  const kycRepository = new PgKycRepository(pool);
  const isMockKyc = process.env.MOCK_KYC !== 'false';
  const kycPort = new MockKycAdapter();
  const kycAppService = new KycAppService(
    kycRepository,
    accountRepository,
    kycPort,
    eventStore,
    logger,
    isMockKyc,
  );

  const campaignRepository = new PgCampaignRepository(pool);
  const kycStatusAdapter = new PgKycStatusAdapter(pool);
  const campaignAppService = new CampaignAppService(
    campaignRepository,
    kycStatusAdapter,
    eventStore,
    logger,
  );

  const extractor = await createClerkAuthExtractor();

  return {
    authPort,
    webhookVerifier,
    accountAppService,
    kycAppService,
    campaignAppService,
    authExtractor: extractor,
    claimsExtractor: extractor,
  };
}
