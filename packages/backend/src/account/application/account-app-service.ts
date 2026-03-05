import type { Logger } from 'pino';
import { ACCOUNT_EVENT_TYPES } from '../domain/account-events.js';
import {
  Account,
  type AccountRole,
  type NotificationPreferences,
  type OnboardingStep,
} from '../domain/account.js';
import type { AccountRepository } from '../ports/account-repository.js';
import type { WebhookEvent } from '../ports/webhook-verification-port.js';
import { AccountNotFoundError } from '../../shared/domain/errors.js';
import type { EventStorePort } from '../../shared/ports/event-store-port.js';

export interface UpdateProfileInput {
  readonly displayName?: string | null;
  readonly bio?: string | null;
  readonly avatarUrl?: string | null;
}

const ADMIN_ROLES: readonly AccountRole[] = ['reviewer', 'administrator', 'super_administrator'];

export class AccountAppService {
  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly eventStore: EventStorePort,
    private readonly logger: Logger,
  ) {}

  async findOrCreateAccount(
    clerkUserId: string,
    email: string,
    displayName: string | null,
  ): Promise<Account> {
    const existing = await this.accountRepository.findByClerkUserId(clerkUserId);
    if (existing) {
      return existing;
    }

    const account = Account.create({ clerkUserId, email, displayName });
    await this.accountRepository.save(account);

    // Handle race condition: if save used ON CONFLICT, the row already existed.
    // Re-fetch to ensure we have the correct data.
    const saved = await this.accountRepository.findByClerkUserId(clerkUserId);
    if (saved) {
      return saved;
    }

    // Fallback: return the created account if re-fetch fails (should not happen)
    return account;
  }

  async getAccountByClerkUserId(clerkUserId: string): Promise<Account | null> {
    return this.accountRepository.findByClerkUserId(clerkUserId);
  }

  async getAccountById(accountId: string): Promise<Account | null> {
    return this.accountRepository.findById(accountId);
  }

  async updateProfile(accountId: string, input: UpdateProfileInput): Promise<Account> {
    const account = await this.accountRepository.findById(accountId);
    if (!account) {
      throw new AccountNotFoundError();
    }

    const updatedAccount = account.withProfile(input.displayName, input.bio, input.avatarUrl);
    await this.accountRepository.update(updatedAccount);

    const changedFields: string[] = [];
    if (input.displayName !== undefined) changedFields.push('display_name');
    if (input.bio !== undefined) changedFields.push('bio');
    if (input.avatarUrl !== undefined) changedFields.push('avatar_url');

    const seqNum = await this.eventStore.getNextSequenceNumber(accountId);
    await this.eventStore.append({
      eventType: ACCOUNT_EVENT_TYPES.PROFILE_UPDATED,
      aggregateId: accountId,
      aggregateType: 'account',
      sequenceNumber: seqNum,
      correlationId: crypto.randomUUID(),
      sourceService: 'account-service',
      payload: { fields_changed: changedFields },
    });

    this.logger.info({ accountId, action: 'profile_updated' }, 'Account profile updated');

    return updatedAccount;
  }

  async updateRoles(accountId: string, onboardingRoles: readonly AccountRole[]): Promise<Account> {
    const account = await this.accountRepository.findById(accountId);
    if (!account) {
      throw new AccountNotFoundError();
    }

    // Preserve admin-assigned roles, replace only onboarding roles
    const existingAdminRoles = account.roles.filter((r) =>
      (ADMIN_ROLES as readonly string[]).includes(r),
    );
    const mergedRoles: AccountRole[] = [
      ...onboardingRoles.filter((r) => !ADMIN_ROLES.includes(r as AccountRole)),
      ...existingAdminRoles,
    ];

    const updatedAccount = account.withRoles(mergedRoles);
    await this.accountRepository.update(updatedAccount);

    const seqNum = await this.eventStore.getNextSequenceNumber(accountId);
    await this.eventStore.append({
      eventType: ACCOUNT_EVENT_TYPES.ROLES_UPDATED,
      aggregateId: accountId,
      aggregateType: 'account',
      sequenceNumber: seqNum,
      correlationId: crypto.randomUUID(),
      sourceService: 'account-service',
      payload: { roles: [...mergedRoles] },
    });

    this.logger.info({ accountId, action: 'roles_updated', roles: mergedRoles }, 'Account roles updated');

    return updatedAccount;
  }

  async advanceOnboardingStep(accountId: string, step: OnboardingStep): Promise<Account> {
    const account = await this.accountRepository.findById(accountId);
    if (!account) {
      throw new AccountNotFoundError();
    }

    const updatedAccount = account.withOnboardingStep(step);
    await this.accountRepository.update(updatedAccount);

    const stepSeqNum = await this.eventStore.getNextSequenceNumber(accountId);
    await this.eventStore.append({
      eventType: ACCOUNT_EVENT_TYPES.ONBOARDING_STEP_COMPLETED,
      aggregateId: accountId,
      aggregateType: 'account',
      sequenceNumber: stepSeqNum,
      correlationId: crypto.randomUUID(),
      sourceService: 'account-service',
      payload: { step },
    });

    if (step === 'completed') {
      const completedSeqNum = await this.eventStore.getNextSequenceNumber(accountId);
      await this.eventStore.append({
        eventType: ACCOUNT_EVENT_TYPES.ONBOARDING_COMPLETED,
        aggregateId: accountId,
        aggregateType: 'account',
        sequenceNumber: completedSeqNum,
        correlationId: crypto.randomUUID(),
        sourceService: 'account-service',
        payload: {},
      });
    }

    this.logger.info(
      { accountId, action: 'onboarding_step_advanced', step },
      'Onboarding step advanced',
    );

    return updatedAccount;
  }

  async updateNotificationPreferences(
    accountId: string,
    prefs: NotificationPreferences,
  ): Promise<Account> {
    const account = await this.accountRepository.findById(accountId);
    if (!account) {
      throw new AccountNotFoundError();
    }

    const updatedAccount = account.withNotificationPreferences(prefs);
    await this.accountRepository.update(updatedAccount);

    const seqNum = await this.eventStore.getNextSequenceNumber(accountId);
    await this.eventStore.append({
      eventType: ACCOUNT_EVENT_TYPES.PREFERENCES_UPDATED,
      aggregateId: accountId,
      aggregateType: 'account',
      sequenceNumber: seqNum,
      correlationId: crypto.randomUUID(),
      sourceService: 'account-service',
      payload: {},
    });

    this.logger.info({ accountId, action: 'preferences_updated' }, 'Notification preferences updated');

    return updatedAccount;
  }

  async handleWebhookEvent(event: WebhookEvent): Promise<void> {
    switch (event.type) {
      case 'user.created':
      case 'user.updated': {
        const primaryEmail = event.data.email_addresses[0]?.email_address ?? '';
        const firstName = event.data.first_name ?? '';
        const lastName = event.data.last_name ?? '';
        const displayName = [firstName, lastName].filter(Boolean).join(' ') || null;

        await this.accountRepository.upsertFromWebhook({
          clerkUserId: event.data.id,
          email: primaryEmail.toLowerCase(),
          displayName,
        });

        this.logger.info(
          { eventType: event.type, clerkUserId: event.data.id },
          'Processed webhook event',
        );
        break;
      }

      case 'user.deleted': {
        await this.accountRepository.updateStatusByClerkUserId(event.data.id, 'deleted');

        this.logger.info(
          { eventType: event.type, clerkUserId: event.data.id },
          'Processed webhook event: account marked as deleted',
        );
        break;
      }

      default: {
        this.logger.warn(
          { eventType: (event as { type: string }).type },
          'Unknown webhook event type, ignoring',
        );
      }
    }
  }
}
