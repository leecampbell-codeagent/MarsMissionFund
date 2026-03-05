import { InvalidWebhookSignatureError } from '../../domain/payment-errors.js';
import type {
  CapturePaymentInput,
  CapturePaymentOutcome,
  NormalisedWebhookEvent,
  PaymentGatewayPort,
  PaymentStatusResult,
  RefundPaymentInput,
  RefundPaymentOutcome,
} from '../../ports/payment-gateway-port.js';

/**
 * Stripe payment gateway adapter.
 * Skeleton implementation — full implementation is a stretch goal for feat-009.
 * The real Stripe SDK is used here; application and domain code never reference it directly.
 */
export class StripePaymentGatewayAdapter implements PaymentGatewayPort {
  private readonly webhookSecret: string;

  constructor(_secretKey: string, webhookSecret: string) {
    this.webhookSecret = webhookSecret;
  }

  async capturePayment(input: CapturePaymentInput): Promise<CapturePaymentOutcome> {
    // Stripe SDK call: stripe.paymentIntents.create({ amount, currency, payment_method, confirm: true, idempotencyKey: contributionId })
    // Skeleton implementation — full Stripe integration is a stretch goal for feat-009.
    throw new Error(
      `StripePaymentGatewayAdapter.capturePayment not yet implemented. Input: ${input.contributionId}`,
    );
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutcome> {
    // Stripe SDK call: stripe.refunds.create({ payment_intent: gatewayReference })
    throw new Error(
      `StripePaymentGatewayAdapter.refundPayment not yet implemented. Reference: ${input.gatewayReference}`,
    );
  }

  async getPaymentStatus(gatewayReference: string): Promise<PaymentStatusResult | null> {
    // Stripe SDK call: stripe.paymentIntents.retrieve(gatewayReference)
    throw new Error(
      `StripePaymentGatewayAdapter.getPaymentStatus not yet implemented. Reference: ${gatewayReference}`,
    );
  }

  async parseWebhookEvent(_rawBody: Buffer, signature: string): Promise<NormalisedWebhookEvent> {
    // Stripe SDK call: stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret)
    // Throws InvalidWebhookSignatureError if signature verification fails
    if (!signature || !this.webhookSecret) {
      throw new InvalidWebhookSignatureError();
    }
    throw new Error('StripePaymentGatewayAdapter.parseWebhookEvent not yet implemented.');
  }
}
