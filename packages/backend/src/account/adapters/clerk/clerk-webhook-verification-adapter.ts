import { Webhook } from 'svix';
import { AuthenticationError } from '../../../shared/domain/errors.js';
import type { WebhookVerificationPort, WebhookEvent } from '../../ports/webhook-verification-port.js';

export class ClerkWebhookVerificationAdapter implements WebhookVerificationPort {
  private readonly webhook: Webhook;

  constructor(signingSecret: string) {
    this.webhook = new Webhook(signingSecret);
  }

  verifyWebhookSignature(payload: string, headers: Record<string, string>): WebhookEvent {
    try {
      const event = this.webhook.verify(payload, headers) as WebhookEvent;
      return event;
    } catch {
      throw new AuthenticationError('Webhook signature verification failed');
    }
  }
}
