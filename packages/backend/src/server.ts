import express from 'express';
import pino from 'pino';
import { pinoHttp } from 'pino-http';
import { UserRepositoryPg } from './account/adapters/UserRepositoryPg';
import { createAccountRouter } from './account/api/account.router';
import { AssignRolesService } from './account/application/AssignRolesService';
import { GetOrCreateUserService } from './account/application/GetOrCreateUserService';
import { UpdateUserProfileService } from './account/application/UpdateUserProfileService';
import { ClerkAuthAdapter } from './shared/adapters/auth/ClerkAuthAdapter';
import { MockAuthAdapter } from './shared/adapters/auth/MockAuthAdapter';
import { pool } from './shared/adapters/db/pool';
import type { AuthPort } from './shared/ports/AuthPort';

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  transport:
    process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
});

const authAdapter: AuthPort =
  process.env.MOCK_AUTH === 'true' ? new MockAuthAdapter() : new ClerkAuthAdapter();

const app = express();

app.use(pinoHttp({ logger }));
app.use(express.json());
app.use(authAdapter.globalMiddleware());

// Health check — public, no auth (per L2-002 §5.4 exception)
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Dependency wiring
const userRepo = new UserRepositoryPg(pool);
const getOrCreateUserService = new GetOrCreateUserService(userRepo);
const updateUserProfileService = new UpdateUserProfileService(userRepo);
const assignRolesService = new AssignRolesService(userRepo);

const accountRouter = createAccountRouter({
  authAdapter,
  userRepo,
  getOrCreateUserService,
  updateUserProfileService,
  assignRolesService,
});

// Protected /v1 route group — all routes require auth
const v1Router = express.Router();
v1Router.use(authAdapter.requireAuthMiddleware());
v1Router.use(accountRouter);
app.use('/v1', v1Router);

const PORT = parseInt(process.env.PORT ?? '3001', 10);

const server = app.listen(PORT, () => {
  logger.info({ port: PORT }, 'Backend server listening');
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received — shutting down gracefully');
  server.close(() => {
    pool.end(() => {
      logger.info('Database pool closed');
      process.exit(0);
    });
  });
});

export { app };
