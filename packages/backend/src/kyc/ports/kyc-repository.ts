import type { KycVerification } from '../domain/kyc-verification.js';

export interface KycRepository {
  findByAccountId(accountId: string): Promise<KycVerification | null>;
  findById(id: string): Promise<KycVerification | null>;
  save(verification: KycVerification): Promise<void>;
  update(verification: KycVerification): Promise<void>;
}
