import type { Logger } from 'pino';
import { AlreadyVerifiedError, KycRequiredError } from '../domain/errors.js';
import type {
  DocumentType,
  IKycAdapter,
  KycStatus,
  KycVerification,
} from '../ports/kyc-adapter.js';

export class KycService {
  constructor(
    private readonly kycAdapter: IKycAdapter,
    private readonly logger: Logger,
  ) {}

  async getStatus(userId: string): Promise<{ status: KycStatus; verifiedAt: Date | null }> {
    const verification = await this.kycAdapter.getStatus(userId);
    if (!verification) {
      return { status: 'not_verified', verifiedAt: null };
    }
    return { status: verification.status, verifiedAt: verification.verifiedAt };
  }

  async submitVerification(userId: string, documentType: DocumentType): Promise<KycVerification> {
    // AlreadyVerifiedError is thrown by the adapter if status === 'verified'.
    // Let it propagate — the controller catches it and returns 409.
    return this.kycAdapter.submit({ userId, documentType });
  }

  async requireVerified(userId: string): Promise<void> {
    const { status } = await this.getStatus(userId);
    if (status !== 'verified') {
      this.logger.warn({ userId, kycStatus: status }, 'KYC check failed — access denied');
      throw new KycRequiredError();
    }
  }
}

// Re-export for consumers that only need the error types
export { AlreadyVerifiedError, KycRequiredError };
