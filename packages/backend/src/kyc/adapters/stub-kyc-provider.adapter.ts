import type { KycSessionResult, KycVerificationPort } from '../ports/kyc-provider.port.js';

export class StubKycVerificationAdapter implements KycVerificationPort {
  constructor(private readonly shouldApprove: boolean = true) {}

  async initiateSession(userId: string): Promise<KycSessionResult> {
    return {
      sessionId: `stub-session-${userId}`,
      outcome: this.shouldApprove ? 'approved' : 'declined',
    };
  }
}
