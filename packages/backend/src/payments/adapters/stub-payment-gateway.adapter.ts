import type {
  CaptureInput,
  CaptureResult,
  PaymentGatewayPort,
} from '../ports/payment-gateway.port.js';

const FAIL_SENTINEL = 'tok_fail';

/**
 * StubPaymentGatewayAdapter — for local demo / testing.
 *
 * Rules:
 *   - paymentToken === 'tok_fail' → failure with descriptive reason
 *   - any other non-empty token   → success with generated transactionRef
 *
 * SECURITY: The paymentToken is NEVER logged at any level.
 */
export class StubPaymentGatewayAdapter implements PaymentGatewayPort {
  async capture(input: CaptureInput): Promise<CaptureResult> {
    // Simulate minimal network latency for demo realism
    await new Promise((resolve) => setTimeout(resolve, 50));

    if (input.paymentToken === FAIL_SENTINEL) {
      return {
        success: false,
        transactionRef: null,
        failureReason:
          'Your payment method was declined. Please check your payment details and try again.',
      };
    }

    return {
      success: true,
      transactionRef: `stub_txn_${input.contributionId}_${Date.now()}`,
      failureReason: null,
    };
  }
}
