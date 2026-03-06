import express, { type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import pino from 'pino';
import { pinoHttp } from 'pino-http';

import { ClerkAdapter } from './account/adapters/clerk/clerk-adapter.js';
import { MockClerkAdapter } from './account/adapters/mock/mock-clerk-adapter.js';
import { MockUserRepository } from './account/adapters/mock/mock-user-repository.js';
import { PgUserRepository } from './account/adapters/pg/pg-user-repository.js';
import { createApiRouter } from './account/api/api-router.js';
import { AuthSyncService } from './account/application/auth-sync-service.js';
import { healthRouter } from './health/api/health-router.js';
import { pool } from './shared/infra/db.js';
import {
  buildClerkMiddleware,
  correlationIdMiddleware,
  createMmfAuthMiddleware,
} from './shared/middleware/auth.js';

const transport = process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined;

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info', transport });

// ---------------------------------------------------------------------------
// Composition root — wire dependencies
// ---------------------------------------------------------------------------

const userRepository =
  process.env.MOCK_AUTH === 'true' ? new MockUserRepository() : new PgUserRepository(pool);

const clerkPort = process.env.MOCK_AUTH === 'true' ? new MockClerkAdapter() : new ClerkAdapter();

const authSyncService = new AuthSyncService(userRepository, clerkPort);

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------

const app = express();

app.use(express.json());

// Security headers via helmet
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        fontSrc: ["'self'"],
        connectSrc: ["'self'", 'https://*.clerk.accounts.dev'],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    strictTransportSecurity: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    xContentTypeOptions: true,
    frameguard: { action: 'deny' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    permittedCrossDomainPolicies: false,
  }),
);

// HTTP request logging — must run before correlationId so we can integrate the ID
app.use(
  pinoHttp({
    logger,
    genReqId: (req) => {
      const incoming = req.headers['x-request-id'];
      const value = Array.isArray(incoming) ? incoming[0] : incoming;
      if (value && /^[a-zA-Z0-9-]{1,128}$/.test(value)) return value;
      return crypto.randomUUID();
    },
  }),
);

// Correlation ID — sets req.correlationId and X-Request-Id response header
app.use(correlationIdMiddleware);

// Public routes (no auth required)
app.use('/health', healthRouter);

// Clerk middleware — verifies JWT (or mock in test mode)
app.use(buildClerkMiddleware());

// MMF auth middleware — lazy sync, account status gating, populates req.auth
app.use(createMmfAuthMiddleware(authSyncService));

// Protected API routes
app.use('/api/v1', createApiRouter(userRepository));

// Global error handler
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction): void => {
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred.',
    },
  });
});

if (process.env.NODE_ENV !== 'test') {
  const port = Number(process.env.PORT ?? 3001);
  app.listen(port, () => {
    logger.info({ port }, 'Backend server started');
  });
}

export { app };
