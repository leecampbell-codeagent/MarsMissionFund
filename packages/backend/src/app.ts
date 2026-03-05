import type { Application, RequestHandler } from 'express';
import express from 'express';
import type { Logger } from 'pino';
// pino-http CJS interop: use require-style import for correct types
import * as pinoHttpModule from 'pino-http';

// pino-http default export is the factory function when used as CJS default interop
const httpLogger =
  (pinoHttpModule as unknown as { default: (opts: { logger: Logger }) => RequestHandler })
    .default ?? pinoHttpModule;

import { createAccountRouter } from './account/api/account-router.js';
import { createWebhookRouter } from './account/api/webhook-router.js';
import type { AccountAppService } from './account/application/account-app-service.js';
import { createKycRouter } from './kyc/api/kyc-router.js';
import type { KycAppService } from './kyc/application/kyc-app-service.js';
import {
  clerkMiddleware,
  correlationIdMiddleware,
  createRequireAuth,
} from './shared/middleware/auth.js';
import { createErrorHandler } from './shared/middleware/error-handler.js';

export interface AppServices {
  accountAppService: AccountAppService;
  kycAppService: KycAppService;
  logger: Logger;
}

export function createApp(services: AppServices): Application {
  const app = express();
  const { logger } = services;

  // Correlation ID middleware (first — all subsequent middleware can access it)
  app.use(correlationIdMiddleware);

  // HTTP request logging
  app.use(httpLogger({ logger }) as RequestHandler);

  // Health check — MUST be before clerkMiddleware (per gotcha G-015)
  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  });

  // Webhook route — uses express.raw() to preserve body for Svix signature verification
  // Must be registered BEFORE express.json() to avoid body parsing
  app.use(
    '/api/v1/webhooks',
    express.raw({ type: 'application/json' }),
    createWebhookRouter(services.accountAppService, logger),
  );

  // JSON body parsing for all other routes
  app.use(express.json());

  // Clerk middleware — attaches req.auth to all requests
  app.use(clerkMiddleware());

  // Protected routes — all /api/v1/* except /webhooks (already registered above)
  const requireAuth = createRequireAuth();
  app.use('/api/v1', requireAuth, createAccountRouter(services.accountAppService));
  app.use('/api/v1/kyc', requireAuth, createKycRouter(services.kycAppService, logger));

  // Global error handler (must be last)
  app.use(createErrorHandler(logger));

  return app;
}




























