import type { Logger } from 'pino';
import { Account } from '../domain/account.js';
import type { AccountRepository } from '../ports/account-repository.js';
import type { WebhookEvent } from '../ports/webhook-verification-port.js';

export class AccountAppService {
  constructor(
    private readonly accountRepository: AccountRepository,
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
