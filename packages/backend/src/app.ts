import express from 'express';
import pinoHttp from 'pino-http';
import { createAccountRouter } from './account/api/account-router.js';
import { createAuthRouter } from './account/api/auth-router.js';
import { createWebhookRouter } from './account/api/webhook-router.js';
import type { AccountAppService } from './account/application/account-app-service.js';
import type { AuthPort } from './account/ports/auth-port.js';
import type { WebhookVerificationPort } from './account/ports/webhook-verification-port.js';
import { createCampaignRouter } from './campaign/api/campaign-router.js';
import type { CampaignAppService } from './campaign/application/campaign-app-service.js';
import { createKycRouter } from './kyc/api/kyc-router.js';
import type { KycAppService } from './kyc/application/kyc-app-service.js';
import { healthRouter } from './health/health.router.js';
import { logger } from './logger.js';
import type { AuthClaimsExtractor } from './shared/middleware/enrich-auth-context.js';
import { createEnrichAuthContext } from './shared/middleware/enrich-auth-context.js';
import type { AuthExtractor } from './shared/middleware/require-authentication.js';
import { createRequireAuthentication } from './shared/middleware/require-authentication.js';

export interface AppDependencies {
  readonly authPort: AuthPort;
  readonly webhookVerifier: WebhookVerificationPort;
  readonly accountAppService: AccountAppService;
  readonly kycAppService?: KycAppService;
  readonly campaignAppService?: CampaignAppService;
  readonly authExtractor: AuthExtractor;
  readonly claimsExtractor: AuthClaimsExtractor;
}

function createApp(deps?: AppDependencies): express.Express {
  const app = express();

  // Structured request logging
  app.use(
    pinoHttp({
      logger,
      // Redact sensitive headers
      serializers: {
        req(req: { id: string; method: string; url: string }) {
          return {
            id: req.id,
            method: req.method,
            url: req.url,
          };
        },
      },
    }),
  );

  // Health route is always public, mounted before any auth middleware
  app.use(healthRouter);

  if (deps) {
    // Webhook route must be mounted BEFORE json body parser and auth middleware
    // because Svix needs the raw body for signature verification
    const webhookRouter = createWebhookRouter(deps.accountAppService, deps.webhookVerifier, logger);
    app.use(webhookRouter);

    // Parse JSON request bodies (for all routes except webhooks which use raw)
    app.use(express.json({ limit: '1mb' }));

    // Auth middleware: parse JWT (Clerk or mock)
    app.use(deps.authPort.getMiddleware());

    // Protected routes: require authentication + enrich context
    const requireAuth = createRequireAuthentication(deps.authExtractor);
    const enrichContext = createEnrichAuthContext(deps.accountAppService, deps.claimsExtractor);

    // Auth routes
    const authRouter = createAuthRouter();
    app.use(requireAuth, enrichContext, authRouter);

    // Account routes (new for feat-004)
    const accountRouter = createAccountRouter(deps.accountAppService);
    app.use(requireAuth, enrichContext, accountRouter);

    // KYC routes (feat-013)
    if (deps.kycAppService) {
      const kycRouter = createKycRouter(deps.kycAppService);
      app.use(requireAuth, enrichContext, kycRouter);
    }

    // Campaign routes (feat-005)
    if (deps.campaignAppService) {
      const campaignRouter = createCampaignRouter(deps.campaignAppService);
      app.use(requireAuth, enrichContext, campaignRouter);
    }
  } else {
    // No deps = simple mode (e.g., health-only tests)
    app.use(express.json({ limit: '1mb' }));
  }

  return app;
}

export { createApp };
