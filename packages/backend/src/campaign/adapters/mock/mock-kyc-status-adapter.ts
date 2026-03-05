import type { KycStatusPort, KycStatusResult } from '../../ports/kyc-status-port.js';

/**
 * Mock KYC status adapter that returns verified by default.
 * For testing: use `setStatus()` to override the status for a specific account.
 */
export class MockKycStatusAdapter implements KycStatusPort {
  private readonly statusMap = new Map<string, string>();
  private defaultStatus: string = 'verified';

  async getVerificationStatus(accountId: string): Promise<KycStatusResult> {
    const status = this.statusMap.get(accountId) ?? this.defaultStatus;
    return { status };
  }

  /** Test helper: set the status for a specific account. */
  setStatus(accountId: string, status: string): void {
    this.statusMap.set(accountId, status);
  }

  /** Test helper: set the default status for all accounts. */
  setDefaultStatus(status: string): void {
    this.defaultStatus = status;
  }

  /** Test helper: clear all overrides. */
  clear(): void {
    this.statusMap.clear();
    this.defaultStatus = 'verified';
  }
}
