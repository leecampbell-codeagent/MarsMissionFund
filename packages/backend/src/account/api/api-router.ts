import { Router } from 'express';
import type { ProfileService } from '../application/profile-service.js';
import type { UserRepository } from '../ports/user-repository.js';
import { createMeRouter } from './me-router.js';

export function createApiRouter(
  userRepository: UserRepository,
  profileService: ProfileService,
): Router {
  const router = Router();

  router.use('/me', createMeRouter(userRepository, profileService));

  return router;
}
