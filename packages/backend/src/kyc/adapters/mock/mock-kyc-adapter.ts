import type { InitiateVerificationResult, KycPort, VerificationStatusResult } from '../../ports/kyc-port.js';

/**
 * Mock KYC adapter that auto-approves verifications.
 * Used when MOCK_KYC=true (default for local dev/workshop).
 */
export class MockKycAdapter implements KycPort {
  private readonly sessions = new Map<string, VerificationStatusResult>();

  async initiateVerification(accountId: string): Promise<InitiateVerificationResult> {
    const sessionId = `mock-kyc-session-${accountId}-${crypto.randomUUID()}`;
    // Auto-approve immediately for mock
    this.sessions.set(sessionId, 'approved');
    return { sessionId };
  }

  async getVerificationStatus(sessionId: string): Promise<VerificationStatusResult> {
    return this.sessions.get(sessionId) ?? 'approved';
  }

  /** Test helper: set a specific status for a session. */
  setSessionStatus(sessionId: string, status: VerificationStatusResult): void {
    this.sessions.set(sessionId, status);
  }
}
