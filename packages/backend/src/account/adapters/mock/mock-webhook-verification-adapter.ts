import type {
  WebhookEvent,
  WebhookVerificationPort,
} from '../../ports/webhook-verification-port.js';

export class MockWebhookVerificationAdapter implements WebhookVerificationPort {
  verifyWebhookSignature(payload: string, _headers: Record<string, string>): WebhookEvent {
    // In mock mode, parse payload as JSON without signature verification
    const event = JSON.parse(payload) as WebhookEvent;
    return event;
  }
}
