import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { MOCK_CLERK_USER_ID, MockAuthAdapter } from '../../shared/adapters/auth/MockAuthAdapter';
import type { AuthPort } from '../../shared/ports/AuthPort';
import type { AssignRolesService } from '../application/AssignRolesService';
import type { GetOrCreateUserService } from '../application/GetOrCreateUserService';
import type { UpdateUserProfileService } from '../application/UpdateUserProfileService';
import { KycStatus } from '../domain/KycStatus';
import { Role } from '../domain/Role';
import { User } from '../domain/User';
import type { UserRepository } from '../ports/UserRepository';
import { createAccountRouter } from './account.router';

// A fixed user returned by most mocks
function makeUser(
  overrides: Partial<{
    id: string;
    clerkId: string;
    email: string;
    roles: Role[];
  }> = {},
): User {
  return User.reconstitute({
    id: overrides.id ?? 'user-uuid-001',
    clerkId: overrides.clerkId ?? MOCK_CLERK_USER_ID,
    email: overrides.email ?? 'astronaut@mars.example',
    displayName: 'Astro Naut',
    avatarUrl: null,
    bio: null,
    roles: overrides.roles ?? [Role.Backer],
    kycStatus: KycStatus.NotVerified,
    onboardingCompleted: false,
    createdAt: new Date('2026-03-07T00:00:00Z'),
    updatedAt: new Date('2026-03-07T00:00:00Z'),
  });
}

function buildTestApp(
  userRepo: UserRepository,
  getOrCreateSvc: Pick<GetOrCreateUserService, 'execute'>,
  updateProfileSvc: Pick<UpdateUserProfileService, 'execute'>,
  assignRolesSvc: Pick<AssignRolesService, 'execute'>,
) {
  const authAdapter = new MockAuthAdapter();
  const app = express();
  app.use(express.json());
  app.use(authAdapter.globalMiddleware());

  const router = createAccountRouter({
    authAdapter,
    userRepo,
    getOrCreateUserService: getOrCreateSvc as GetOrCreateUserService,
    updateUserProfileService: updateProfileSvc as UpdateUserProfileService,
    assignRolesService: assignRolesSvc as AssignRolesService,
  });

  const v1 = express.Router();
  v1.use(authAdapter.requireAuthMiddleware());
  v1.use(router);
  app.use('/v1', v1);

  return app;
}

function makeDefaultMocks() {
  const user = makeUser();
  const userRepo: UserRepository = {
    findByClerkId: vi.fn().mockResolvedValue(user),
    findById: vi.fn().mockResolvedValue(user),
    upsert: vi.fn().mockResolvedValue(user),
    updateProfile: vi.fn().mockResolvedValue(user),
    updateRoles: vi.fn().mockResolvedValue(user),
  };
  const getOrCreateSvc: Pick<GetOrCreateUserService, 'execute'> = {
    execute: vi.fn().mockResolvedValue(user),
  };
  const updateProfileSvc: Pick<UpdateUserProfileService, 'execute'> = {
    execute: vi.fn().mockResolvedValue(user),
  };
  const assignRolesSvc: Pick<AssignRolesService, 'execute'> = {
    execute: vi.fn().mockResolvedValue(user),
  };
  return { user, userRepo, getOrCreateSvc, updateProfileSvc, assignRolesSvc };
}

// Auth adapter that passes requireAuth but returns null from getAuthContext
const nullAuthAdapter: AuthPort = {
  getAuthContext: () => null,
  requireAuthMiddleware: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  globalMiddleware: () => (_req: Request, _res: Response, next: NextFunction) => next(),
};

function buildNullAuthApp(
  userRepo: UserRepository,
  getOrCreateSvc: Pick<GetOrCreateUserService, 'execute'>,
  updateProfileSvc: Pick<UpdateUserProfileService, 'execute'>,
  assignRolesSvc: Pick<AssignRolesService, 'execute'>,
) {
  const app = express();
  app.use(express.json());
  app.use(nullAuthAdapter.globalMiddleware());

  const router = createAccountRouter({
    authAdapter: nullAuthAdapter,
    userRepo,
    getOrCreateUserService: getOrCreateSvc as GetOrCreateUserService,
    updateUserProfileService: updateProfileSvc as UpdateUserProfileService,
    assignRolesService: assignRolesSvc as AssignRolesService,
  });

  const v1 = express.Router();
  v1.use(nullAuthAdapter.requireAuthMiddleware());
  v1.use(router);
  app.use('/v1', v1);

  return app;
}

describe('null auth context — handler-level 401', () => {
  it('GET /me returns 401 when auth context is null', async () => {
    const { userRepo, getOrCreateSvc, updateProfileSvc, assignRolesSvc } = makeDefaultMocks();
    const app = buildNullAuthApp(userRepo, getOrCreateSvc, updateProfileSvc, assignRolesSvc);

    const res = await request(app).get('/v1/me');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('PATCH /me returns 401 when auth context is null', async () => {
    const { userRepo, getOrCreateSvc, updateProfileSvc, assignRolesSvc } = makeDefaultMocks();
    const app = buildNullAuthApp(userRepo, getOrCreateSvc, updateProfileSvc, assignRolesSvc);

    const res = await request(app).patch('/v1/me').send({ display_name: 'Test' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('GET /me/roles returns 401 when auth context is null', async () => {
    const { userRepo, getOrCreateSvc, updateProfileSvc, assignRolesSvc } = makeDefaultMocks();
    const app = buildNullAuthApp(userRepo, getOrCreateSvc, updateProfileSvc, assignRolesSvc);

    const res = await request(app).get('/v1/me/roles');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('POST /admin/users/:id/roles returns 401 when auth context is null', async () => {
    const { userRepo, getOrCreateSvc, updateProfileSvc, assignRolesSvc } = makeDefaultMocks();
    const app = buildNullAuthApp(userRepo, getOrCreateSvc, updateProfileSvc, assignRolesSvc);

    const res = await request(app)
      .post('/v1/admin/users/target-uuid/roles')
      .send({ roles: [Role.Creator] });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});

describe('unhandled errors — 500 fallback', () => {
  it('GET /me returns 500 when service throws unexpected error', async () => {
    const { userRepo, assignRolesSvc, updateProfileSvc } = makeDefaultMocks();
    const explodingSvc: Pick<GetOrCreateUserService, 'execute'> = {
      execute: vi.fn().mockRejectedValue(new Error('DB connection lost')),
    };
    const app = buildTestApp(userRepo, explodingSvc, updateProfileSvc, assignRolesSvc);

    const res = await request(app).get('/v1/me');

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_SERVER_ERROR');
  });
});

describe('GET /v1/me', () => {
  it('creates user record on first call and returns profile without clerk_id', async () => {
    const { userRepo, getOrCreateSvc, updateProfileSvc, assignRolesSvc } = makeDefaultMocks();
    const app = buildTestApp(userRepo, getOrCreateSvc, updateProfileSvc, assignRolesSvc);

    const res = await request(app).get('/v1/me');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('email');
    expect(res.body).toHaveProperty('roles');
    expect(res.body).toHaveProperty('kycStatus');
    expect(res.body).toHaveProperty('onboardingCompleted');
    // clerk_id must NEVER appear in the response
    expect(res.body).not.toHaveProperty('clerkId');
    expect(res.body).not.toHaveProperty('clerk_id');
  });

  it('calls getOrCreateUserService.execute with mock clerk user id', async () => {
    const { userRepo, getOrCreateSvc, updateProfileSvc, assignRolesSvc } = makeDefaultMocks();
    const app = buildTestApp(userRepo, getOrCreateSvc, updateProfileSvc, assignRolesSvc);

    await request(app).get('/v1/me');

    expect(getOrCreateSvc.execute).toHaveBeenCalledWith(MOCK_CLERK_USER_ID, expect.any(String));
  });

  it('returns 200 with user data', async () => {
    const { userRepo, getOrCreateSvc, updateProfileSvc, assignRolesSvc, user } = makeDefaultMocks();
    const app = buildTestApp(userRepo, getOrCreateSvc, updateProfileSvc, assignRolesSvc);

    const res = await request(app).get('/v1/me');

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(user.id);
    expect(res.body.email).toBe(user.email);
    expect(res.body.roles).toEqual([Role.Backer]);
    expect(res.body.kycStatus).toBe(KycStatus.NotVerified);
    expect(res.body.onboardingCompleted).toBe(false);
  });
});

describe('PATCH /v1/me', () => {
  it('updates profile with valid body and returns 200', async () => {
    const updatedUser = makeUser();
    const { userRepo, getOrCreateSvc, assignRolesSvc } = makeDefaultMocks();
    const updateProfileSvc: Pick<UpdateUserProfileService, 'execute'> = {
      execute: vi.fn().mockResolvedValue(
        User.reconstitute({
          ...updatedUser,
          displayName: 'New Name',
          bio: 'New bio',
        }),
      ),
    };
    const app = buildTestApp(userRepo, getOrCreateSvc, updateProfileSvc, assignRolesSvc);

    const res = await request(app)
      .patch('/v1/me')
      .send({ display_name: 'New Name', bio: 'New bio' });

    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty('clerk_id');
    expect(res.body).not.toHaveProperty('clerkId');
  });

  it('returns 400 when avatar_url is not a valid URL', async () => {
    const { userRepo, getOrCreateSvc, updateProfileSvc, assignRolesSvc } = makeDefaultMocks();
    const app = buildTestApp(userRepo, getOrCreateSvc, updateProfileSvc, assignRolesSvc);

    const res = await request(app).patch('/v1/me').send({ avatar_url: 'not-a-url' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('returns 404 when user is not found in repo', async () => {
    const { getOrCreateSvc, updateProfileSvc, assignRolesSvc } = makeDefaultMocks();
    const userRepo: UserRepository = {
      findByClerkId: vi.fn().mockResolvedValue(null),
      findById: vi.fn().mockResolvedValue(null),
      upsert: vi.fn(),
      updateProfile: vi.fn().mockResolvedValue(null),
      updateRoles: vi.fn().mockResolvedValue(null),
    };
    const app = buildTestApp(userRepo, getOrCreateSvc, updateProfileSvc, assignRolesSvc);

    const res = await request(app).patch('/v1/me').send({ display_name: 'Test' });

    expect(res.status).toBe(404);
  });
});

describe('GET /v1/me/roles', () => {
  it('returns the user roles array', async () => {
    const { userRepo, getOrCreateSvc, updateProfileSvc, assignRolesSvc } = makeDefaultMocks();
    const app = buildTestApp(userRepo, getOrCreateSvc, updateProfileSvc, assignRolesSvc);

    const res = await request(app).get('/v1/me/roles');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('roles');
    expect(Array.isArray(res.body.roles)).toBe(true);
  });

  it('returns 404 when user is not found in repo', async () => {
    const { getOrCreateSvc, updateProfileSvc, assignRolesSvc } = makeDefaultMocks();
    const userRepo: UserRepository = {
      findByClerkId: vi.fn().mockResolvedValue(null),
      findById: vi.fn().mockResolvedValue(null),
      upsert: vi.fn(),
      updateProfile: vi.fn().mockResolvedValue(null),
      updateRoles: vi.fn().mockResolvedValue(null),
    };
    const app = buildTestApp(userRepo, getOrCreateSvc, updateProfileSvc, assignRolesSvc);

    const res = await request(app).get('/v1/me/roles');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('USER_NOT_FOUND');
  });
});

describe('POST /v1/admin/users/:id/roles', () => {
  it('returns 404 when actor user is not found in repo', async () => {
    const { getOrCreateSvc, updateProfileSvc, assignRolesSvc } = makeDefaultMocks();
    const userRepo: UserRepository = {
      findByClerkId: vi.fn().mockResolvedValue(null),
      findById: vi.fn().mockResolvedValue(null),
      upsert: vi.fn(),
      updateProfile: vi.fn().mockResolvedValue(null),
      updateRoles: vi.fn().mockResolvedValue(null),
    };
    const app = buildTestApp(userRepo, getOrCreateSvc, updateProfileSvc, assignRolesSvc);

    const res = await request(app)
      .post('/v1/admin/users/target-uuid/roles')
      .send({ roles: [Role.Creator] });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('USER_NOT_FOUND');
  });

  it('returns 403 when actor is a non-administrator (Backer)', async () => {
    const backerUser = makeUser({ roles: [Role.Backer] });
    const { userRepo, getOrCreateSvc, updateProfileSvc } = makeDefaultMocks();
    // Patch repo to return backer user
    const repoWithBacker: UserRepository = {
      ...userRepo,
      findByClerkId: vi.fn().mockResolvedValue(backerUser),
    };

    // Use a service that throws the actual domain error
    const { RoleAssignmentForbiddenError } = await import(
      '../domain/errors/RoleAssignmentForbiddenError'
    );
    const realAssignRolesSvc: Pick<AssignRolesService, 'execute'> = {
      execute: vi.fn().mockRejectedValue(new RoleAssignmentForbiddenError()),
    };

    const app = buildTestApp(repoWithBacker, getOrCreateSvc, updateProfileSvc, realAssignRolesSvc);

    const res = await request(app)
      .post('/v1/admin/users/target-uuid/roles')
      .send({ roles: [Role.Creator] });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ROLE_ASSIGNMENT_FORBIDDEN');
  });

  it('returns 403 when super_administrator is in roles list', async () => {
    const { userRepo, getOrCreateSvc, updateProfileSvc } = makeDefaultMocks();
    const { SuperAdminAssignmentRestrictedError } = await import(
      '../domain/errors/SuperAdminAssignmentRestrictedError'
    );
    const assignRolesSvc: Pick<AssignRolesService, 'execute'> = {
      execute: vi.fn().mockRejectedValue(new SuperAdminAssignmentRestrictedError()),
    };
    const app = buildTestApp(userRepo, getOrCreateSvc, updateProfileSvc, assignRolesSvc);

    const res = await request(app)
      .post('/v1/admin/users/target-uuid/roles')
      .send({ roles: [Role.SuperAdministrator] });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('SUPER_ADMIN_ASSIGNMENT_RESTRICTED');
  });

  it('returns 400 when unknown role is provided', async () => {
    const { userRepo, getOrCreateSvc, updateProfileSvc } = makeDefaultMocks();
    const { InvalidRoleError } = await import('../domain/errors/InvalidRoleError');
    const assignRolesSvc: Pick<AssignRolesService, 'execute'> = {
      execute: vi.fn().mockRejectedValue(new InvalidRoleError('dragon_master')),
    };
    const app = buildTestApp(userRepo, getOrCreateSvc, updateProfileSvc, assignRolesSvc);

    const res = await request(app)
      .post('/v1/admin/users/target-uuid/roles')
      .send({ roles: ['dragon_master'] });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_ROLE');
  });

  it('returns 400 when roles array is empty', async () => {
    const { userRepo, getOrCreateSvc, updateProfileSvc, assignRolesSvc } = makeDefaultMocks();
    const app = buildTestApp(userRepo, getOrCreateSvc, updateProfileSvc, assignRolesSvc);

    const res = await request(app).post('/v1/admin/users/target-uuid/roles').send({ roles: [] });

    expect(res.status).toBe(400);
  });

  it('returns 200 with updated user when Administrator assigns valid roles', async () => {
    const adminUser = makeUser({ roles: [Role.Administrator] });
    const updatedTarget = makeUser({ id: 'target-uuid', roles: [Role.Creator] });

    const repoWithAdmin: UserRepository = {
      findByClerkId: vi.fn().mockResolvedValue(adminUser),
      findById: vi.fn().mockResolvedValue(updatedTarget),
      upsert: vi.fn(),
      updateProfile: vi.fn().mockResolvedValue(null),
      updateRoles: vi.fn().mockResolvedValue(updatedTarget),
    };
    const { getOrCreateSvc, updateProfileSvc } = makeDefaultMocks();
    const assignRolesSvc: Pick<AssignRolesService, 'execute'> = {
      execute: vi.fn().mockResolvedValue(updatedTarget),
    };

    const app = buildTestApp(repoWithAdmin, getOrCreateSvc, updateProfileSvc, assignRolesSvc);

    const res = await request(app)
      .post('/v1/admin/users/target-uuid/roles')
      .send({ roles: [Role.Creator] });

    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty('clerk_id');
    expect(res.body).not.toHaveProperty('clerkId');
  });
});
