import { Router } from 'express';
import { z } from 'zod';
import {
  AccountNotFoundError,
  InvalidAccountDataError,
  InvalidOnboardingStepError,
} from '../../shared/domain/errors.js';
import type { AccountAppService } from '../application/account-app-service.js';

const updateProfileSchema = z
  .object({
    display_name: z.string().trim().min(1).max(100).nullish(),
    bio: z.string().trim().max(500).nullish(),
    avatar_url: z.string().url().startsWith('https://').nullish(),
  })
  .strict();

const updatePreferencesSchema = z
  .object({
    campaign_updates: z.boolean(),
    milestone_completions: z.boolean(),
    contribution_confirmations: z.boolean(),
    new_campaign_recommendations: z.boolean(),
    security_alerts: z.boolean(),
    platform_announcements: z.boolean(),
  })
  .strict();

const advanceOnboardingSchema = z
  .object({
    step: z.enum(['role_selection', 'profile', 'preferences', 'completed']),
    roles: z.array(z.enum(['backer', 'creator'])).min(1).optional(),
  })
  .strict();

function formatAccount(account: import('../domain/account.js').Account) {
  return {
    id: account.id,
    email: account.email,
    display_name: account.displayName,
    bio: account.bio,
    avatar_url: account.avatarUrl,
    status: account.status,
    roles: [...account.roles],
    onboarding_completed: account.onboardingCompleted,
    onboarding_step: account.onboardingStep,
    notification_preferences: account.notificationPreferences,
  };
}

function zodErrorMessage(error: z.ZodError): string {
  // Zod v4 uses .issues, Zod v3 uses .errors — support both
  const issues = (error as unknown as { issues?: { message: string }[] }).issues ??
    (error as unknown as { errors?: { message: string }[] }).errors ??
    [];
  return issues[0]?.message ?? 'Validation failed.';
}

function zodErrorDetails(error: z.ZodError): unknown[] {
  const issues = (error as unknown as { issues?: unknown[] }).issues ??
    (error as unknown as { errors?: unknown[] }).errors ??
    [];
  return issues;
}

function handleDomainError(
  error: unknown,
  res: import('express').Response,
  req: import('express').Request,
): void {
  if (error instanceof AccountNotFoundError) {
    res.status(404).json({
      error: { code: error.code, message: error.message, correlation_id: req.id },
    });
    return;
  }
  if (error instanceof InvalidAccountDataError || error instanceof InvalidOnboardingStepError) {
    res.status(400).json({
      error: { code: error.code, message: error.message, correlation_id: req.id },
    });
    return;
  }
  // Re-throw for generic error handler
  throw error;
}

export function createAccountRouter(accountAppService: AccountAppService): Router {
  const router = Router();

  /** GET /api/v1/accounts/me — returns full account for authenticated user */
  router.get('/api/v1/accounts/me', async (req, res, next) => {
    try {
      const accountId = req.authContext?.userId;
      if (!accountId) {
        res.status(401).json({
          error: { code: 'UNAUTHENTICATED', message: 'Authentication required.', correlation_id: req.id },
        });
        return;
      }

      const account = await accountAppService.getAccountById(accountId);
      if (!account) {
        res.status(404).json({
          error: { code: 'ACCOUNT_NOT_FOUND', message: 'Account not found.', correlation_id: req.id },
        });
        return;
      }

      res.status(200).json({ data: formatAccount(account) });
    } catch (error) {
      next(error);
    }
  });

  /** PATCH /api/v1/accounts/me — updates profile fields */
  router.patch('/api/v1/accounts/me', async (req, res, next) => {
    try {
      const accountId = req.authContext?.userId;
      if (!accountId) {
        res.status(401).json({
          error: { code: 'UNAUTHENTICATED', message: 'Authentication required.', correlation_id: req.id },
        });
        return;
      }

      // Reject empty body
      if (!req.body || Object.keys(req.body as object).length === 0) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'At least one field must be provided.',
            correlation_id: req.id,
          },
        });
        return;
      }

      const parseResult = updateProfileSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: zodErrorMessage(parseResult.error),
            details: zodErrorDetails(parseResult.error),
            correlation_id: req.id,
          },
        });
        return;
      }

      const { display_name, bio, avatar_url } = parseResult.data;

      try {
        const updatedAccount = await accountAppService.updateProfile(accountId, {
          displayName: display_name,
          bio,
          avatarUrl: avatar_url,
        });

        res.status(200).json({ data: formatAccount(updatedAccount) });
      } catch (err) {
        handleDomainError(err, res, req);
      }
    } catch (error) {
      next(error);
    }
  });

  /** PATCH /api/v1/accounts/me/preferences — updates notification preferences */
  router.patch('/api/v1/accounts/me/preferences', async (req, res, next) => {
    try {
      const accountId = req.authContext?.userId;
      if (!accountId) {
        res.status(401).json({
          error: { code: 'UNAUTHENTICATED', message: 'Authentication required.', correlation_id: req.id },
        });
        return;
      }

      const parseResult = updatePreferencesSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: zodErrorMessage(parseResult.error),
            details: zodErrorDetails(parseResult.error),
            correlation_id: req.id,
          },
        });
        return;
      }

      try {
        const updatedAccount = await accountAppService.updateNotificationPreferences(
          accountId,
          parseResult.data,
        );

        res.status(200).json({
          data: { notification_preferences: updatedAccount.notificationPreferences },
        });
      } catch (err) {
        handleDomainError(err, res, req);
      }
    } catch (error) {
      next(error);
    }
  });

  /** PATCH /api/v1/accounts/me/onboarding — advances onboarding step */
  router.patch('/api/v1/accounts/me/onboarding', async (req, res, next) => {
    try {
      const accountId = req.authContext?.userId;
      if (!accountId) {
        res.status(401).json({
          error: { code: 'UNAUTHENTICATED', message: 'Authentication required.', correlation_id: req.id },
        });
        return;
      }

      const parseResult = advanceOnboardingSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: zodErrorMessage(parseResult.error),
            details: zodErrorDetails(parseResult.error),
            correlation_id: req.id,
          },
        });
        return;
      }

      const { step, roles } = parseResult.data;

      try {
        // If roles provided, update them first (merging with existing admin roles)
        if (roles && roles.length > 0) {
          await accountAppService.updateRoles(accountId, roles);
        }

        // Advance the onboarding step
        const updatedAccount = await accountAppService.advanceOnboardingStep(accountId, step);

        res.status(200).json({
          data: {
            id: updatedAccount.id,
            onboarding_completed: updatedAccount.onboardingCompleted,
            onboarding_step: updatedAccount.onboardingStep,
            roles: [...updatedAccount.roles],
          },
        });
      } catch (err) {
        // Handle idempotent completion: if already at/past step, return current account
        if (err instanceof InvalidOnboardingStepError) {
          const current = await accountAppService.getAccountById(accountId);
          if (current) {
            res.status(200).json({
              data: {
                id: current.id,
                onboarding_completed: current.onboardingCompleted,
                onboarding_step: current.onboardingStep,
                roles: [...current.roles],
              },
            });
            return;
          }
        }
        handleDomainError(err, res, req);
      }
    } catch (error) {
      next(error);
    }
  });

  return router;
}
