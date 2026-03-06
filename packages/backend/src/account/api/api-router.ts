import { Router } from 'express';
import type { UserRepository } from '../ports/user-repository.js';
import { createMeRouter } from './me-router.js';

export function createApiRouter(userRepository: UserRepository): Router {
  const router = Router();

  router.use('/me', createMeRouter(userRepository));

  return router;
}
