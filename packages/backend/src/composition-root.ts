import type { Pool } from 'pg';
import type { Logger } from 'pino';
import { ClerkAuthAdapter } from './account/adapters/clerk-auth.adapter.js';
import { MockClerkAuthAdapter } from './account/adapters/mock-clerk-auth.adapter.js';
import { PgUserRepository } from './account/adapters/pg-user-repository.adapter.js';
import { PinoAuditLoggerAdapter } from './account/adapters/pino-audit-logger.adapter.js';
import { AccountAppService } from './account/application/account-app-service.js';

/**
 * Wires all dependencies manually (no DI containers).
 * Returns the application services used by the Express app.
 */
export function createServices(
  pool: Pool,
  logger: Logger,
): { accountAppService: AccountAppService } {
  const userRepository = new PgUserRepository(pool);

  // Use mock Clerk adapter when MOCK_CLERK=true (local dev / CI without Clerk credentials)
  const clerkAuth =
    process.env.MOCK_CLERK === 'true' ? new MockClerkAuthAdapter() : new ClerkAuthAdapter();

  const auditLogger = new PinoAuditLoggerAdapter(logger);

  const accountAppService = new AccountAppService(userRepository, clerkAuth, auditLogger, logger);

  return { accountAppService };
}




























