import { Router } from 'express';
import { createKycRouter } from '../../kyc/api/kyc-router.js';
import type { KycService } from '../../kyc/application/kyc-service.js';
import type { ProfileService } from '../application/profile-service.js';
import type { UserRepository } from '../ports/user-repository.js';
import { createMeRouter } from './me-router.js';

export function createApiRouter(
  userRepository: UserRepository,
  profileService: ProfileService,
  kycService: KycService,
): Router {
  const router = Router();

  router.use('/me', createMeRouter(userRepository, profileService));
  router.use('/kyc', createKycRouter(kycService));

  return router;
}
