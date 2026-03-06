import { AlreadyVerifiedError } from '../../domain/errors.js';
import type {
  IKycAdapter,
  KycStatus,
  KycVerification,
  SubmitKycInput,
} from '../../ports/kyc-adapter.js';

export class MockKycAdapter implements IKycAdapter {
  private readonly store: Map<string, KycVerification> = new Map();

  async getStatus(userId: string): Promise<KycVerification | null> {
    return this.store.get(userId) ?? null;
  }

  async submit(input: SubmitKycInput): Promise<KycVerification> {
    const existing = this.store.get(input.userId);
    if (existing?.status === 'verified') {
      throw new AlreadyVerifiedError();
    }

    const result: KycVerification = {
      userId: input.userId,
      status: 'verified',
      verifiedAt: new Date(),
      providerReference: null,
    };
    this.store.set(input.userId, result);
    return result;
  }

  /** Test helper — pre-seed a user's KYC state without going through submit() */
  setStatus(userId: string, status: KycStatus, verifiedAt: Date | null = null): void {
    this.store.set(userId, { userId, status, verifiedAt, providerReference: null });
  }

  /** Test helper — clear all stored state between tests */
  clear(): void {
    this.store.clear();
  }
}
