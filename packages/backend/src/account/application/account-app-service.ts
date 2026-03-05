import type { Logger } from 'pino';
import { KycNotVerifiedError } from '../../campaign/domain/errors/campaign-errors.js';
import {
  AccountNotActiveError,
  AccountSuspendedError,
  InvalidClerkUserIdError,
  SecurityAlertsCannotBeDisabledError,
  UserNotFoundError,
} from '../domain/errors/account-errors.js';
import { type UpdateProfileInput, User } from '../domain/models/user.js';
import { AccountStatus } from '../domain/value-objects/account-status.js';
import type { NotificationPreferences } from '../domain/value-objects/notification-preferences.js';
import { Role } from '../domain/value-objects/role.js';
import { AuditActions, type AuditLoggerPort } from '../ports/audit-logger.port.js';
import type { ClerkAuthPort } from '../ports/clerk-auth.port.js';
import type { UserRepository } from '../ports/user-repository.port.js';

export interface SyncUserInput {
  readonly clerkUserId: string;
  readonly email: string;
  readonly accountStatus: AccountStatus;
}

export interface ClerkWebhookEvent {
  readonly type: 'user.created' | 'user.updated' | 'session.created';
  readonly data: {
    readonly id: string;
    readonly email_addresses?: ReadonlyArray<{
      readonly email_address: string;
      readonly verification: { readonly status: 'verified' | 'unverified' };
    }>;
  };
}

export class AccountAppService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly clerkAuth: ClerkAuthPort,
    private readonly auditLogger: AuditLoggerPort,
    private readonly logger: Logger,
  ) {}

  /**
   * Upserts an MMF user record for the authenticated Clerk user.
   * Called by POST /api/v1/auth/sync.
   */
  async syncUser(input: SyncUserInput): Promise<User> {
    // Defence in depth — requireAuth() should have blocked empty clerkUserId
    if (!input.clerkUserId || input.clerkUserId.trim() === '') {
      throw new InvalidClerkUserIdError();
    }

    const normalizedEmail = input.email.toLowerCase().trim();

    const user = User.create({
      clerkUserId: input.clerkUserId,
      email: normalizedEmail,
      accountStatus: input.accountStatus,
    });

    // WARN-005: If accountStatus is Active and roles array is empty, assign Backer role
    const userToUpsert =
      input.accountStatus === AccountStatus.Active && user.roles.length === 0
        ? User.reconstitute({
            id: user.id,
            clerkUserId: user.clerkUserId,
            email: user.email,
            displayName: user.displayName,
            bio: user.bio,
            avatarUrl: user.avatarUrl,
            accountStatus: user.accountStatus,
            onboardingCompleted: user.onboardingCompleted,
            onboardingStep: user.onboardingStep,
            roles: [Role.Backer],
            notificationPrefs: user.notificationPrefs,
            kycStatus: user.kycStatus,
            lastSeenAt: user.lastSeenAt,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
          })
        : user;

    const persistedUser = await this.userRepository.upsertByClerkUserId(userToUpsert);

    await this.auditLogger.log({
      action: AuditActions.UserSynced,
      actorClerkUserId: input.clerkUserId,
      resourceType: 'user',
      resourceId: persistedUser.id,
      timestamp: new Date(),
    });

    return persistedUser;
  }

  /**
   * Syncs a user using data fetched from Clerk's API.
   * Called by POST /api/v1/auth/sync when email is not available in the JWT claims.
   * Fetches user metadata from Clerk, then delegates to syncUser.
   */
  async syncFromClerkApi(clerkUserId: string): Promise<User> {
    const metadata = await this.clerkAuth.getUserMetadata(clerkUserId);
    const accountStatus = metadata.emailVerified
      ? AccountStatus.Active
      : AccountStatus.PendingVerification;

    return this.syncUser({
      clerkUserId,
      email: metadata.email,
      accountStatus,
    });
  }

  /**
   * Returns the authenticated user's full profile.
   * Called by GET /api/v1/me.
   */
  async getMe(clerkUserId: string): Promise<User> {
    const user = await this.userRepository.findByClerkUserId(clerkUserId);
    if (!user) {
      throw new UserNotFoundError(clerkUserId);
    }
    return user;
  }

  /**
   * Updates the authenticated user's profile fields.
   * Called by PATCH /api/v1/me/profile.
   */
  async updateProfile(clerkUserId: string, input: UpdateProfileInput): Promise<User> {
    const user = await this.userRepository.findByClerkUserId(clerkUserId);
    if (!user) {
      throw new UserNotFoundError(clerkUserId);
    }

    // Domain validates field lengths, normalises empty strings to null
    const updatedUser = user.updateProfile(input);

    const persistedUser = await this.userRepository.updateProfile(clerkUserId, {
      displayName: updatedUser.displayName,
      bio: updatedUser.bio,
      avatarUrl: updatedUser.avatarUrl,
      onboardingCompleted: updatedUser.onboardingCompleted,
      onboardingStep: updatedUser.onboardingStep,
    });

    const changedFields = (Object.keys(input) as Array<keyof UpdateProfileInput>).filter(
      (k) => input[k] !== undefined,
    );

    await this.auditLogger.log({
      action: AuditActions.ProfileUpdated,
      actorClerkUserId: clerkUserId,
      resourceType: 'user',
      resourceId: user.id,
      timestamp: new Date(),
      metadata: { fields: changedFields },
    });

    return persistedUser;
  }

  /**
   * Returns the authenticated user's notification preferences.
   * Called by GET /api/v1/me/notifications.
   */
  async getNotificationPrefs(clerkUserId: string): Promise<NotificationPreferences> {
    const user = await this.userRepository.findByClerkUserId(clerkUserId);
    if (!user) {
      throw new UserNotFoundError(clerkUserId);
    }
    return user.notificationPrefs;
  }

  /**
   * Merges partial notification preference updates.
   * Called by PATCH /api/v1/me/notifications.
   */
  async updateNotificationPrefs(
    clerkUserId: string,
    prefs: Partial<NotificationPreferences>,
  ): Promise<NotificationPreferences> {
    const user = await this.userRepository.findByClerkUserId(clerkUserId);
    if (!user) {
      throw new UserNotFoundError(clerkUserId);
    }

    // Guard: securityAlerts cannot be false (also blocked by Zod schema — defence in depth)
    // Cast through unknown to check runtime value despite literal true type
    if ('securityAlerts' in prefs && (prefs.securityAlerts as unknown) === false) {
      throw new SecurityAlertsCannotBeDisabledError();
    }

    const merged: NotificationPreferences = {
      ...user.notificationPrefs,
      ...prefs,
      securityAlerts: true, // Always force true
    };

    const updatedUser = await this.userRepository.updateNotificationPrefs(clerkUserId, merged);

    await this.auditLogger.log({
      action: AuditActions.NotificationsUpdated,
      actorClerkUserId: clerkUserId,
      resourceType: 'user',
      resourceId: user.id,
      timestamp: new Date(),
    });

    return updatedUser.notificationPrefs;
  }

  /**
   * Marks onboarding as complete for the authenticated user.
   * Called by POST /api/v1/me/onboarding/complete.
   */
  async completeOnboarding(clerkUserId: string): Promise<User> {
    const user = await this.userRepository.findByClerkUserId(clerkUserId);
    if (!user) {
      throw new UserNotFoundError(clerkUserId);
    }

    const updatedUser = await this.userRepository.completeOnboarding(clerkUserId);

    await this.auditLogger.log({
      action: AuditActions.ProfileUpdated,
      actorClerkUserId: clerkUserId,
      resourceType: 'user',
      resourceId: user.id,
      timestamp: new Date(),
      metadata: { fields: ['onboardingCompleted', 'onboardingStep'] },
    });

    return updatedUser;
  }

  /**
   * Assigns the Creator role to the authenticated user.
   * Idempotent — returns user unchanged if already a Creator.
   * Called by POST /api/v1/me/roles/creator.
   */
  async assignCreatorRole(clerkUserId: string): Promise<User> {
    // Step 1: Load user
    const user = await this.userRepository.findByClerkUserId(clerkUserId);
    if (!user) {
      throw new UserNotFoundError(clerkUserId);
    }

    // Step 2: Account status check
    if (user.accountStatus === AccountStatus.PendingVerification) {
      throw new AccountNotActiveError();
    }
    if (
      user.accountStatus === AccountStatus.Suspended ||
      user.accountStatus === AccountStatus.Deactivated
    ) {
      throw new AccountSuspendedError();
    }

    // Step 3: KYC check
    if (user.kycStatus !== 'verified') {
      throw new KycNotVerifiedError();
    }

    // Step 4: Idempotency — return user unchanged if already creator
    if (user.roles.includes(Role.Creator)) {
      return user;
    }

    // Step 5: Assign role
    const updatedUser = user.assignRole(Role.Creator);

    // Step 6: Persist
    const persistedUser = await this.userRepository.updateAccountStatus(
      clerkUserId,
      user.accountStatus,
      updatedUser.roles,
    );

    // Step 7: Sync Clerk metadata (best-effort)
    try {
      await this.clerkAuth.setPublicMetadata(clerkUserId, {
        role: updatedUser.roles[0] ?? 'backer',
      });
    } catch (err) {
      this.logger.warn(
        { clerkUserId, err },
        'Failed to sync publicMetadata to Clerk after creator role assignment — JWT cache may be stale',
      );
    }

    // Step 8: Audit (best-effort)
    try {
      await this.auditLogger.log({
        action: AuditActions.RoleAssigned,
        actorClerkUserId: clerkUserId,
        resourceType: 'user',
        resourceId: user.id,
        timestamp: new Date(),
        metadata: { role: 'creator' },
      });
    } catch (auditErr) {
      this.logger.error(
        { err: auditErr, clerkUserId },
        'Failed to write audit event for creator role assignment',
      );
    }

    return persistedUser;
  }

  /**
   * Handles Clerk lifecycle webhooks.
   * Called by POST /api/v1/webhooks/clerk.
   */
  async handleClerkWebhook(event: ClerkWebhookEvent): Promise<void> {
    this.logger.debug({ eventType: event.type }, 'Processing Clerk webhook');

    if (event.type === 'session.created') {
      // Log only — no state change for feat-001
      this.logger.debug({ clerkUserId: event.data.id }, 'session.created — no action');
      return;
    }

    const clerkUserId = event.data.id;

    if (!event.data.email_addresses || event.data.email_addresses.length === 0) {
      this.logger.warn(
        { clerkUserId, eventType: event.type },
        'Webhook received with no email_addresses — no-op',
      );
      return;
    }

    const primaryEmailEntry = event.data.email_addresses[0];
    if (!primaryEmailEntry) {
      this.logger.warn({ clerkUserId }, 'No primary email entry — no-op');
      return;
    }
    const email = primaryEmailEntry.email_address.toLowerCase().trim();
    const emailVerified = primaryEmailEntry.verification.status === 'verified';
    const accountStatus = emailVerified ? AccountStatus.Active : AccountStatus.PendingVerification;

    if (event.type === 'user.created') {
      // Determine initial roles — WARN-005: assign Backer if active
      const roles: Role[] = accountStatus === AccountStatus.Active ? [Role.Backer] : [];

      const user = User.create({ clerkUserId, email, accountStatus });
      // Override roles on the created user
      const userWithRoles = User.reconstitute({
        id: user.id,
        clerkUserId: user.clerkUserId,
        email: user.email,
        displayName: user.displayName,
        bio: user.bio,
        avatarUrl: user.avatarUrl,
        accountStatus: user.accountStatus,
        onboardingCompleted: user.onboardingCompleted,
        onboardingStep: user.onboardingStep,
        roles,
        notificationPrefs: user.notificationPrefs,
        kycStatus: user.kycStatus,
        lastSeenAt: user.lastSeenAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      });

      const persisted = await this.userRepository.upsertByClerkUserId(userWithRoles);

      await this.auditLogger.log({
        action: AuditActions.UserSynced,
        actorClerkUserId: clerkUserId,
        resourceType: 'user',
        resourceId: persisted.id,
        timestamp: new Date(),
      });

      return;
    }

    if (event.type === 'user.updated') {
      // Find existing user, create if not found (out-of-order delivery)
      let existingUser = await this.userRepository.findByClerkUserId(clerkUserId);

      if (!existingUser) {
        // Out-of-order delivery: create the user
        this.logger.warn(
          { clerkUserId },
          'user.updated received before user.created — creating user',
        );
        const roles: Role[] = accountStatus === AccountStatus.Active ? [Role.Backer] : [];
        const user = User.create({ clerkUserId, email, accountStatus });
        const userWithRoles = User.reconstitute({
          id: user.id,
          clerkUserId: user.clerkUserId,
          email: user.email,
          displayName: user.displayName,
          bio: user.bio,
          avatarUrl: user.avatarUrl,
          accountStatus: user.accountStatus,
          onboardingCompleted: user.onboardingCompleted,
          onboardingStep: user.onboardingStep,
          roles,
          notificationPrefs: user.notificationPrefs,
          kycStatus: user.kycStatus,
          lastSeenAt: user.lastSeenAt,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        });
        existingUser = await this.userRepository.upsertByClerkUserId(userWithRoles);
      }

      // If email verified AND not already active → activate and assign Backer role
      if (emailVerified && existingUser.accountStatus !== AccountStatus.Active) {
        const newRoles = existingUser.roles.includes(Role.Backer)
          ? existingUser.roles
          : [...existingUser.roles, Role.Backer];

        await this.userRepository.updateAccountStatus(
          clerkUserId,
          AccountStatus.Active,
          newRoles,
          email,
        );

        // Sync primary role to Clerk JWT cache
        try {
          await this.clerkAuth.setPublicMetadata(clerkUserId, { role: Role.Backer });
        } catch (err) {
          // Non-fatal: role is correct in DB; JWT cache is stale until next token refresh
          this.logger.warn(
            { clerkUserId, err },
            'Failed to sync publicMetadata to Clerk — JWT cache may be stale',
          );
        }

        await this.auditLogger.log({
          action: AuditActions.AccountActivated,
          actorClerkUserId: clerkUserId,
          resourceType: 'user',
          resourceId: existingUser.id,
          timestamp: new Date(),
        });
      } else if (email !== existingUser.email) {
        // Email changed — update stored email
        await this.userRepository.updateAccountStatus(
          clerkUserId,
          existingUser.accountStatus,
          existingUser.roles,
          email,
        );
      }

      return;
    }
  }
}
