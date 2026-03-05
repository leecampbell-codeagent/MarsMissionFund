import type { Pool } from 'pg';
import type { Logger } from 'pino';
import { ClerkAuthAdapter } from './account/adapters/clerk-auth.adapter.js';
import { MockClerkAuthAdapter } from './account/adapters/mock-clerk-auth.adapter.js';
import { PgUserRepository } from './account/adapters/pg-user-repository.adapter.js';
import { PinoAuditLoggerAdapter } from './account/adapters/pino-audit-logger.adapter.js';
import { AccountAppService } from './account/application/account-app-service.js';
import { PgCampaignAuditRepository } from './campaign/adapters/pg-campaign-audit-repository.adapter.js';
import { PgCampaignRepository } from './campaign/adapters/pg-campaign-repository.adapter.js';
import { CampaignAppService } from './campaign/application/campaign-app-service.js';
import { PgKycAuditRepository } from './kyc/adapters/pg-kyc-audit-repository.adapter.js';
import { StubKycVerificationAdapter } from './kyc/adapters/stub-kyc-provider.adapter.js';
import { KycAppService } from './kyc/application/kyc-app-service.js';
import type { KycVerificationPort } from './kyc/ports/kyc-provider.port.js';

/**
 * Wires all dependencies manually (no DI containers).
 * Returns the application services used by the Express app.
 */
export function createServices(
  pool: Pool,
  logger: Logger,
): {
  accountAppService: AccountAppService;
  kycAppService: KycAppService;
  campaignAppService: CampaignAppService;
} {
  const userRepository = new PgUserRepository(pool);

  // Use mock Clerk adapter when MOCK_CLERK=true (local dev / CI without Clerk credentials)
  const clerkAuth =
    process.env.MOCK_CLERK === 'true' ? new MockClerkAuthAdapter() : new ClerkAuthAdapter();

  const auditLogger = new PinoAuditLoggerAdapter(logger);

  const accountAppService = new AccountAppService(userRepository, clerkAuth, auditLogger, logger);

  // KYC provider — default to stub (MOCK_KYC=true unless explicitly set to false)
  const mockKyc = process.env.MOCK_KYC !== 'false';
  const kycProvider: KycVerificationPort = mockKyc
    ? new StubKycVerificationAdapter(true)
    : (() => {
        throw new Error('Real KYC provider not implemented');
      })();

  // KYC audit repository
  const kycAuditRepository = new PgKycAuditRepository(pool);

  // KYC app service — shares userRepository with AccountAppService
  const kycAppService = new KycAppService(userRepository, kycProvider, kycAuditRepository, logger);

  // Campaign repositories
  const campaignRepository = new PgCampaignRepository(pool);
  const campaignAuditRepository = new PgCampaignAuditRepository(pool);

  // Campaign app service — shares userRepository with AccountAppService and KycAppService
  const campaignAppService = new CampaignAppService(
    campaignRepository,
    campaignAuditRepository,
    userRepository,
    logger,
  );

  return { accountAppService, kycAppService, campaignAppService };
}
