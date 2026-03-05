export interface CapturePaymentInput {
  readonly contributionId: string;
  readonly amountCents: number;
  readonly currency: 'usd';
  readonly paymentMethodToken: string;
  readonly metadata: {
    readonly campaignId: string;
    readonly donorId: string;
    readonly contributionId: string;
  };
}

export interface CapturePaymentResult {
  readonly success: true;
  readonly gatewayReference: string;
}

export interface CapturePaymentFailure {
  readonly success: false;
  readonly errorCode: string;
  readonly errorMessage: string;
}

export type CapturePaymentOutcome = CapturePaymentResult | CapturePaymentFailure;

export interface RefundPaymentInput {
  readonly gatewayReference: string;
  readonly amountCents: number;
  readonly reason: 'requested_by_customer' | 'duplicate' | 'fraudulent';
}

export interface RefundPaymentResult {
  readonly success: true;
  readonly refundReference: string;
}

export type RefundPaymentOutcome = RefundPaymentResult | { readonly success: false; readonly errorMessage: string };

export interface PaymentStatusResult {
  readonly status: 'succeeded' | 'processing' | 'failed' | 'canceled';
  readonly gatewayReference: string;
}

export interface NormalisedWebhookEvent {
  readonly eventId: string;
  readonly eventType:
    | 'payment_intent.succeeded'
    | 'payment_intent.payment_failed'
    | 'charge.refunded'
    | 'charge.refund.updated'
    | 'unknown';
  readonly contributionId: string | null;
  readonly gatewayReference: string | null;
  readonly amountCents: number | null;
}

export interface PaymentGatewayPort {
  capturePayment(input: CapturePaymentInput): Promise<CapturePaymentOutcome>;
  refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutcome>;
  getPaymentStatus(gatewayReference: string): Promise<PaymentStatusResult | null>;
  parseWebhookEvent(rawBody: Buffer, signature: string): Promise<NormalisedWebhookEvent>;
}
