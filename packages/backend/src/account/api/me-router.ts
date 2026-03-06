import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import type { UserRepository } from '../ports/user-repository.js';

export function createMeRouter(userRepository: UserRepository): Router {
  const router = Router();

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

      res.status(200).json({
        data: {
          id: user.id,
          clerkUserId: user.clerkUserId,
          email: user.email,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          accountStatus: user.accountStatus,
          onboardingCompleted: user.onboardingCompleted,
          roles: user.roles,
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString(),
        },
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
