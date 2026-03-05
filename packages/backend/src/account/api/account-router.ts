import { Router } from 'express';
import { z } from 'zod';
import { getClerkAuth } from '../../shared/middleware/auth.js';
import type { AccountAppService } from '../application/account-app-service.js';
import { AccountStatus } from '../domain/value-objects/account-status.js';
import { serializeUser } from './user-serializer.js';

// PATCH /api/v1/me/profile schema — onboardingCompleted and onboardingStep removed (HIGH-003)
const updateProfileSchema = z
  .object({
    displayName: z
      .string()
      .max(255)
      .nullable()
      .optional()
      .transform((v) => (v === '' ? null : v)),
    bio: z
      .string()
      .max(500)
      .nullable()
      .optional()
      .transform((v) => (v === '' ? null : v)),
    avatarUrl: z.string().url().nullable().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

// PATCH /api/v1/me/notifications schema — securityAlerts NOT accepted
const updateNotificationsSchema = z
  .object({
    campaignUpdates: z.boolean().optional(),
    milestoneCompletions: z.boolean().optional(),
    contributionConfirmations: z.boolean().optional(),
    recommendations: z.boolean().optional(),
    platformAnnouncements: z.boolean().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export function createAccountRouter(accountAppService: AccountAppService): Router {
  const router = Router();

  /**
   * POST /api/v1/auth/sync
   * Upserts the MMF user record for the authenticated Clerk user.
   */
  router.post('/auth/sync', async (req, res, next) => {
    try {
      const auth = getClerkAuth(req);
      if (!auth) {
        res.status(401).json({
          error: {
            code: 'UNAUTHENTICATED',
            message: 'Authentication required. Sign in to continue.',
            correlation_id: req.correlationId ?? null,
          },
        });
        return;
      }

      const clerkUserId = auth.userId;

      // Extract email from JWT claims — requires Clerk JWT template to include 'email' claim.
      // If not present in JWT, fall back to fetching via Clerk API.
      const sessionClaims = req.auth?.sessionClaims ?? {};
      const emailFromJwt = (sessionClaims.email as string | undefined) ?? '';
      const emailVerifiedFromJwt = Boolean(sessionClaims.email_verified);

      let user: Awaited<ReturnType<typeof accountAppService.syncUser>>;

      if (emailFromJwt) {
        const accountStatus = emailVerifiedFromJwt
          ? AccountStatus.Active
          : AccountStatus.PendingVerification;
        user = await accountAppService.syncUser({
          clerkUserId,
          email: emailFromJwt,
          accountStatus,
        });
      } else {
        // Email not in JWT — fetch from Clerk API via service method
        user = await accountAppService.syncFromClerkApi(clerkUserId);
      }

      res.status(200).json({ data: serializeUser(user) });
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /api/v1/me
   * Returns the authenticated user's full profile.
   */
  router.get('/me', async (req, res, next) => {
    try {
      const auth = getClerkAuth(req);
      if (!auth) {
        res.status(401).json({
          error: {
            code: 'UNAUTHENTICATED',
            message: 'Authentication required. Sign in to continue.',
            correlation_id: req.correlationId ?? null,
          },
        });
        return;
      }

      const user = await accountAppService.getMe(auth.userId);
      res.status(200).json({ data: serializeUser(user) });
    } catch (err) {
      next(err);
    }
  });

  /**
   * PATCH /api/v1/me/profile
   * Updates the authenticated user's display name, bio, and/or avatar URL.
   * WARN-004: route is /me/profile (not /profile)
   */
  router.patch('/me/profile', async (req, res, next) => {
    try {
      const auth = getClerkAuth(req);
      if (!auth) {
        res.status(401).json({
          error: {
            code: 'UNAUTHENTICATED',
            message: 'Authentication required. Sign in to continue.',
            correlation_id: req.correlationId ?? null,
          },
        });
        return;
      }

      const parseResult = updateProfileSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request body is invalid.',
            correlation_id: req.correlationId ?? null,
            issues: parseResult.error.issues.map((i) => ({
              path: i.path.join('.'),
              message: i.message,
            })),
          },
        });
        return;
      }

      const user = await accountAppService.updateProfile(auth.userId, parseResult.data);
      res.status(200).json({ data: serializeUser(user) });
    } catch (err) {
      next(err);
    }
  });

  /**
   * POST /api/v1/me/onboarding/complete
   * Marks the authenticated user's onboarding as complete.
   * Dedicated endpoint — onboardingCompleted is NOT accepted via PATCH /me/profile (HIGH-003).
   */
  router.post('/me/onboarding/complete', async (req, res, next) => {
    try {
      const auth = getClerkAuth(req);
      if (!auth) {
        res.status(401).json({
          error: {
            code: 'UNAUTHENTICATED',
            message: 'Authentication required. Sign in to continue.',
            correlation_id: req.correlationId ?? null,
          },
        });
        return;
      }

      const user = await accountAppService.completeOnboarding(auth.userId);
      res.status(200).json({ data: serializeUser(user) });
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /api/v1/me/notifications
   * Returns the authenticated user's notification preferences.
   */
  router.get('/me/notifications', async (req, res, next) => {
    try {
      const auth = getClerkAuth(req);
      if (!auth) {
        res.status(401).json({
          error: {
            code: 'UNAUTHENTICATED',
            message: 'Authentication required. Sign in to continue.',
            correlation_id: req.correlationId ?? null,
          },
        });
        return;
      }

      const prefs = await accountAppService.getNotificationPrefs(auth.userId);
      res.status(200).json({ data: prefs });
    } catch (err) {
      next(err);
    }
  });

  /**
   * POST /api/v1/me/roles/creator
   * Self-designate as a Creator. Idempotent — no error if already Creator.
   */
  router.post('/me/roles/creator', async (req, res, next) => {
    try {
      const auth = getClerkAuth(req);
      if (!auth) {
        res.status(401).json({
          error: {
            code: 'UNAUTHENTICATED',
            message: 'Authentication required. Sign in to continue.',
            correlation_id: req.correlationId ?? null,
          },
        });
        return;
      }

      // Reject any request body fields
      const parseResult = z
        .object({})
        .strict()
        .safeParse(req.body ?? {});
      if (!parseResult.success) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'No request body fields are accepted for this endpoint.',
            correlation_id: req.correlationId ?? null,
          },
        });
        return;
      }

      const user = await accountAppService.assignCreatorRole(auth.userId);
      res.status(200).json({ data: serializeUser(user) });
    } catch (err) {
      next(err);
    }
  });

  /**
   * PATCH /api/v1/me/notifications
   * Updates the authenticated user's notification preferences (partial merge).
   */
  router.patch('/me/notifications', async (req, res, next) => {
    try {
      const auth = getClerkAuth(req);
      if (!auth) {
        res.status(401).json({
          error: {
            code: 'UNAUTHENTICATED',
            message: 'Authentication required. Sign in to continue.',
            correlation_id: req.correlationId ?? null,
          },
        });
        return;
      }

      const parseResult = updateNotificationsSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request body is invalid.',
            correlation_id: req.correlationId ?? null,
            issues: parseResult.error.issues.map((i) => ({
              path: i.path.join('.'),
              message: i.message,
            })),
          },
        });
        return;
      }

      const prefs = await accountAppService.updateNotificationPrefs(auth.userId, parseResult.data);
      res.status(200).json({ data: prefs });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
