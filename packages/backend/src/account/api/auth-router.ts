import { Router } from 'express';

export function createAuthRouter(): Router {
  const router = Router();

  router.get('/api/v1/auth/me', (req, res) => {
    const ctx = req.authContext;
    if (!ctx) {
      // Should not happen if requireAuthentication + enrichAuthContext middleware ran
      res.status(401).json({
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Authentication required.',
          correlation_id: req.id,
        },
      });
      return;
    }

    res.status(200).json({
      data: {
        id: ctx.userId,
        email: ctx.email,
        display_name: ctx.displayName,
        status: ctx.accountStatus,
        roles: [...ctx.roles],
        onboarding_completed: ctx.onboardingCompleted,
      },
    });
  });

  return router;
}
