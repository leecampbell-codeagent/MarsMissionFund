import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import type { ProfileService } from '../application/profile-service.js';
import type { User } from '../domain/models/user.js';
import type { UserRepository } from '../ports/user-repository.js';

const updateProfileSchema = z.object({
  display_name: z
    .string()
    .trim()
    .min(1, 'Display name cannot be empty')
    .max(100)
    .nullable()
    .optional(),
  bio: z.string().max(500).nullable().optional(),
});

const updateNotificationPreferencesSchema = z
  .object({
    campaign_updates: z.boolean(),
    milestone_completions: z.boolean(),
    contribution_confirmations: z.boolean(),
    new_recommendations: z.boolean(),
    platform_announcements: z.boolean(),
  })
  .strict();

const completeOnboardingSchema = z.object({
  step: z.number().int().min(1).max(3),
  roles: z
    .array(z.enum(['backer', 'creator']))
    .min(1)
    .max(2),
  display_name: z.string().trim().min(1).max(100).nullable().optional(),
  bio: z.string().max(500).nullable().optional(),
});

const saveOnboardingStepSchema = z.object({
  step: z.number().int().min(1).max(3),
});

function mapUserToResponse(user: User) {
  return {
    id: user.id,
    clerkUserId: user.clerkUserId,
    email: user.email,
    displayName: user.displayName,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    accountStatus: user.accountStatus,
    onboardingCompleted: user.onboardingCompleted,
    onboardingStep: user.onboardingStep,
    roles: user.roles,
    notificationPreferences: {
      ...user.notificationPreferences,
      security_alerts: true,
    },
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export function createMeRouter(
  userRepository: UserRepository,
  profileService: ProfileService,
): Router {
  const router = Router();

  // GET /api/v1/me
  router.get('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.auth) {
        res.status(401).json({
          error: { code: 'UNAUTHORIZED', message: 'Authentication required.' },
        });
        return;
      }

      const user = await userRepository.findById(req.auth.userId);

      if (!user) {
        res.status(404).json({
          error: { code: 'USER_NOT_FOUND', message: 'User not found.' },
        });
        return;
      }

      res.status(200).json({ data: mapUserToResponse(user) });
    } catch (err) {
      next(err);
    }
  });

  // PUT /api/v1/me
  router.put('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.auth) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required.',
            correlation_id: req.correlationId,
          },
        });
        return;
      }

      const parsed = updateProfileSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message ?? 'Validation failed.',
            correlation_id: req.correlationId,
          },
        });
        return;
      }

      const { display_name, bio } = parsed.data;

      const fields: { displayName?: string | null; bio?: string | null } = {};
      if ('display_name' in parsed.data) {
        fields.displayName = display_name ?? null;
      }
      if ('bio' in parsed.data) {
        fields.bio = bio ?? null;
      }

      const user = await profileService.updateProfile(req.auth.userId, fields);

      if (!user) {
        res.status(404).json({
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found.',
            correlation_id: req.correlationId,
          },
        });
        return;
      }

      res.status(200).json({ data: mapUserToResponse(user) });
    } catch (err) {
      next(err);
    }
  });

  // PUT /api/v1/me/notification-preferences
  router.put(
    '/notification-preferences',
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        if (!req.auth) {
          res.status(401).json({
            error: {
              code: 'UNAUTHORIZED',
              message: 'Authentication required.',
              correlation_id: req.correlationId,
            },
          });
          return;
        }

        const parsed = updateNotificationPreferencesSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({
            error: {
              code: 'VALIDATION_ERROR',
              message: parsed.error.issues[0]?.message ?? 'Validation failed.',
              correlation_id: req.correlationId,
            },
          });
          return;
        }

        const user = await profileService.updateNotificationPreferences(
          req.auth.userId,
          parsed.data,
        );

        res.status(200).json({ data: mapUserToResponse(user) });
      } catch (err) {
        next(err);
      }
    },
  );

  // POST /api/v1/me/onboarding/complete
  router.post(
    '/onboarding/complete',
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        if (!req.auth) {
          res.status(401).json({
            error: {
              code: 'UNAUTHORIZED',
              message: 'Authentication required.',
              correlation_id: req.correlationId,
            },
          });
          return;
        }

        const parsed = completeOnboardingSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({
            error: {
              code: 'VALIDATION_ERROR',
              message: parsed.error.issues[0]?.message ?? 'Validation failed.',
              correlation_id: req.correlationId,
            },
          });
          return;
        }

        const { step, roles, display_name, bio } = parsed.data;

        const user = await profileService.completeOnboarding(req.auth.userId, {
          step,
          roles,
          displayName: display_name,
          bio,
        });

        res.status(200).json({ data: mapUserToResponse(user) });
      } catch (err) {
        next(err);
      }
    },
  );

  // PATCH /api/v1/me/onboarding/step
  router.patch(
    '/onboarding/step',
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        if (!req.auth) {
          res.status(401).json({
            error: {
              code: 'UNAUTHORIZED',
              message: 'Authentication required.',
              correlation_id: req.correlationId,
            },
          });
          return;
        }

        const parsed = saveOnboardingStepSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({
            error: {
              code: 'VALIDATION_ERROR',
              message: parsed.error.issues[0]?.message ?? 'Validation failed.',
              correlation_id: req.correlationId,
            },
          });
          return;
        }

        await profileService.saveOnboardingStep(req.auth.userId, parsed.data.step);
        res.status(204).send();
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
