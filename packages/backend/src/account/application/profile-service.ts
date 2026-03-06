import pino from 'pino';
import type { User } from '../domain/models/user.js';
import type { NotificationPreferences } from '../domain/value-objects/notification-preferences.js';
import type { UserRepository } from '../ports/user-repository.js';

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });

export interface UpdateProfileInput {
  displayName?: string | null;
  bio?: string | null;
}

export interface CompleteOnboardingInput {
  step: number;
  roles: ('backer' | 'creator')[];
  displayName?: string | null;
  bio?: string | null;
}

export class ProfileService {
  constructor(private readonly userRepo: UserRepository) {}

  async updateProfile(userId: string, fields: UpdateProfileInput): Promise<User> {
    logger.info({ userId, operation: 'updateProfile' }, 'Updating user profile');
    return this.userRepo.updateProfile(userId, fields);
  }

  async updateNotificationPreferences(
    userId: string,
    prefs: NotificationPreferences,
  ): Promise<User> {
    logger.info(
      { userId, operation: 'updateNotificationPreferences' },
      'Updating notification preferences',
    );
    return this.userRepo.updateNotificationPreferences(userId, prefs);
  }

  async completeOnboarding(userId: string, input: CompleteOnboardingInput): Promise<User> {
    logger.info({ userId, operation: 'completeOnboarding' }, 'Completing onboarding');
    return this.userRepo.completeOnboarding(userId, input);
  }

  async saveOnboardingStep(userId: string, step: number): Promise<void> {
    logger.info({ userId, operation: 'saveOnboardingStep' }, 'Saving onboarding step');
    return this.userRepo.saveOnboardingStep(userId, step);
  }
}
