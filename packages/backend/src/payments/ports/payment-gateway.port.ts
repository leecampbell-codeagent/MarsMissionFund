export interface CaptureInput {
  readonly contributionId: string;
  readonly amountCents: number;
  readonly paymentToken: string; // NEVER LOG
  readonly campaignId: string;
  readonly donorUserId: string;
}

export interface CaptureResult {
  readonly success: boolean;
  readonly transactionRef: string | null; // Populated on success; null on failure
  readonly failureReason: string | null; // Populated on failure; null on success
}

export interface PaymentGatewayPort {
  capture(input: CaptureInput): Promise<CaptureResult>;
}
