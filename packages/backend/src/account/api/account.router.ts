import express, { type Request, type Response } from 'express';
import pino from 'pino';
import { DomainError } from '../../shared/domain/errors/DomainError';
import type { AuthPort } from '../../shared/ports/AuthPort';
import type { AssignRolesService } from '../application/AssignRolesService';
import type { GetOrCreateUserService } from '../application/GetOrCreateUserService';
import type { UpdateUserProfileService } from '../application/UpdateUserProfileService';
import type { User } from '../domain/User';
import type { UserRepository } from '../ports/UserRepository';
import { assignRolesSchema, patchMeSchema } from './account.schemas';

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  transport:
    process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
});

const DOMAIN_ERROR_STATUS: Record<string, number> = {
  USER_NOT_FOUND: 404,
  USER_ALREADY_EXISTS: 409,
  ROLE_ASSIGNMENT_FORBIDDEN: 403,
  INVALID_ROLE: 400,
  SUPER_ADMIN_ASSIGNMENT_RESTRICTED: 403,
  USER_VALIDATION_ERROR: 400,
};

function serializeUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    roles: user.roles,
    kycStatus: user.kycStatus,
    onboardingCompleted: user.onboardingCompleted,
  };
}

function handleError(res: Response, err: unknown, correlationId: string) {
  if (err instanceof DomainError) {
    const status = DOMAIN_ERROR_STATUS[err.code] ?? 500;
    return res.status(status).json({
      error: { code: err.code, message: err.message, correlation_id: correlationId },
    });
  }
  logger.error({ err, correlation_id: correlationId }, 'Unhandled error in account router');
  return res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred.',
      correlation_id: correlationId,
    },
  });
}

export interface AccountRouterDeps {
  authAdapter: AuthPort;
  userRepo: UserRepository;
  getOrCreateUserService: GetOrCreateUserService;
  updateUserProfileService: UpdateUserProfileService;
  assignRolesService: AssignRolesService;
}

export function createAccountRouter(deps: AccountRouterDeps) {
  const {
    authAdapter,
    userRepo,
    getOrCreateUserService,
    updateUserProfileService,
    assignRolesService,
  } = deps;

  const router = express.Router();

  // GET /me — get or create authenticated user profile
  router.get('/me', async (req: Request, res: Response) => {
    const correlationId = (req.headers['x-correlation-id'] as string) ?? crypto.randomUUID();
    try {
      const authContext = authAdapter.getAuthContext(req);
      if (!authContext) {
        return res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required.',
            correlation_id: correlationId,
          },
        });
      }

      // Extract email from Clerk session claims (populated by clerkMiddleware)
      // For mock auth, fall back to a placeholder that passes validation
      const reqAny = req as Request & { auth?: { sessionClaims?: { email?: string } } };
      const email = (reqAny.auth?.sessionClaims?.email as string | undefined) ?? 'mock@example.com';

      const user = await getOrCreateUserService.execute(authContext.clerkUserId, email);
      return res.status(200).json(serializeUser(user));
    } catch (err) {
      return handleError(res, err, correlationId);
    }
  });

  // PATCH /me — update profile fields
  router.patch('/me', async (req: Request, res: Response) => {
    const correlationId = (req.headers['x-correlation-id'] as string) ?? crypto.randomUUID();
    try {
      const authContext = authAdapter.getAuthContext(req);
      if (!authContext) {
        return res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required.',
            correlation_id: correlationId,
          },
        });
      }

      const parseResult = patchMeSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: parseResult.error.errors.map((e) => e.message).join(', '),
            correlation_id: correlationId,
          },
        });
      }

      const existingUser = await userRepo.findByClerkId(authContext.clerkUserId);
      if (!existingUser) {
        return res.status(404).json({
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found.',
            correlation_id: correlationId,
          },
        });
      }

      const body = parseResult.data;
      const updated = await updateUserProfileService.execute(existingUser.id, {
        displayName: body.display_name,
        bio: body.bio,
        avatarUrl: body.avatar_url,
      });

      return res.status(200).json(serializeUser(updated));
    } catch (err) {
      return handleError(res, err, correlationId);
    }
  });

  // GET /me/roles — get current user's roles
  router.get('/me/roles', async (req: Request, res: Response) => {
    const correlationId = (req.headers['x-correlation-id'] as string) ?? crypto.randomUUID();
    try {
      const authContext = authAdapter.getAuthContext(req);
      if (!authContext) {
        return res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required.',
            correlation_id: correlationId,
          },
        });
      }

      const user = await userRepo.findByClerkId(authContext.clerkUserId);
      if (!user) {
        return res.status(404).json({
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found.',
            correlation_id: correlationId,
          },
        });
      }

      return res.status(200).json({ roles: user.roles });
    } catch (err) {
      return handleError(res, err, correlationId);
    }
  });

  // POST /admin/users/:id/roles — assign roles (Administrator only)
  router.post('/admin/users/:id/roles', async (req: Request, res: Response) => {
    const correlationId = (req.headers['x-correlation-id'] as string) ?? crypto.randomUUID();
    try {
      const authContext = authAdapter.getAuthContext(req);
      if (!authContext) {
        return res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required.',
            correlation_id: correlationId,
          },
        });
      }

      const parseResult = assignRolesSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: parseResult.error.errors.map((e) => e.message).join(', '),
            correlation_id: correlationId,
          },
        });
      }

      const actorUser = await userRepo.findByClerkId(authContext.clerkUserId);
      if (!actorUser) {
        return res.status(404).json({
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found.',
            correlation_id: correlationId,
          },
        });
      }

      const targetUserId = req.params.id as string;
      const { roles } = parseResult.data;

      const updatedTarget = await assignRolesService.execute(actorUser, targetUserId, roles);

      logger.info(
        {
          actor_id: actorUser.id,
          target_id: targetUserId,
          new_roles: roles,
          timestamp: new Date().toISOString(),
        },
        'Role assignment performed',
      );

      return res.status(200).json(serializeUser(updatedTarget));
    } catch (err) {
      return handleError(res, err, correlationId);
    }
  });

  return router;
}
