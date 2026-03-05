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
 * Sentinel signature value that forces the mock to reject with InvalidWebhookSignatureError.
 * Use this value in tests to exercise the invalid-signature code path.
 */
export const MOCK_INVALID_SIGNATURE = 'invalid-sig';

type WebhookEventType =
  | 'payment_intent.succeeded'
  | 'payment_intent.payment_failed'
  | 'charge.refunded'
  | 'charge.refund.updated'
  | 'unknown';

const KNOWN_EVENT_TYPES: readonly WebhookEventType[] = [
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
  'charge.refunded',
  'charge.refund.updated',
];

function isKnownEventType(type: string): type is Exclude<WebhookEventType, 'unknown'> {
  return KNOWN_EVENT_TYPES.includes(type as WebhookEventType);
}

export class MockPaymentGatewayAdapter implements PaymentGatewayPort {
  async capturePayment(input: CapturePaymentInput): Promise<CapturePaymentOutcome> {
    const token = input.paymentMethodToken;

    if (token.includes('tok_chargeDeclined')) {
      return {
        success: false,
        errorCode: 'CARD_DECLINED',
        errorMessage: 'Your card was declined.',
      };
    }

    if (token.includes('tok_insufficient_funds')) {
      return {
        success: false,
        errorCode: 'INSUFFICIENT_FUNDS',
        errorMessage: 'Insufficient funds.',
      };
    }

    // tok_visa, tok_success, or any other token → success
    return {
      success: true,
      gatewayReference: `pi_mock_${input.contributionId}`,
    };
  }

  async refundPayment(_input: RefundPaymentInput): Promise<RefundPaymentOutcome> {
    return {
      success: true,
      refundReference: `re_mock_${Date.now()}`,
    };
  }

  async getPaymentStatus(gatewayReference: string): Promise<PaymentStatusResult | null> {
    return {
      status: 'succeeded',
      gatewayReference,
    };
  }

  async parseWebhookEvent(rawBody: Buffer, signature: string): Promise<NormalisedWebhookEvent> {
    if (signature === MOCK_INVALID_SIGNATURE) {
      throw new InvalidWebhookSignatureError();
    }

    const body = JSON.parse(rawBody.toString('utf8')) as Record<string, unknown>;

    const eventId = typeof body.id === 'string' ? body.id : `mock_evt_${Date.now()}`;
    const rawType = typeof body.type === 'string' ? body.type : '';
    const eventType: WebhookEventType = isKnownEventType(rawType) ? rawType : 'unknown';

    const dataObj =
      body.data && typeof body.data === 'object'
        ? (body.data as Record<string, unknown>)
        : {};

    const dataObject =
      dataObj.object && typeof dataObj.object === 'object'
        ? (dataObj.object as Record<string, unknown>)
        : {};

    const metadata =
      dataObject.metadata && typeof dataObject.metadata === 'object'
        ? (dataObject.metadata as Record<string, unknown>)
        : {};

    const contributionId =
      typeof metadata.contributionId === 'string' ? metadata.contributionId : null;

    const gatewayReference =
      typeof dataObject.id === 'string' ? dataObject.id : null;

    const amountCents =
      typeof dataObject.amount === 'number' ? dataObject.amount : null;

    return {
      eventId,
      eventType,
      contributionId,
      gatewayReference,
      amountCents,
    };
  }
}
