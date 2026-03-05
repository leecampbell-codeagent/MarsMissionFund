import type { KycVerification } from '../../domain/kyc-verification.js';
import type { KycRepository } from '../../ports/kyc-repository.js';

export class InMemoryKycRepository implements KycRepository {
  private readonly verifications = new Map<string, KycVerification>();
  private readonly byAccountId = new Map<string, string>(); // accountId -> id

  async findByAccountId(accountId: string): Promise<KycVerification | null> {
    const id = this.byAccountId.get(accountId);
    if (!id) return null;
    return this.verifications.get(id) ?? null;
  }

  async findById(id: string): Promise<KycVerification | null> {
    return this.verifications.get(id) ?? null;
  }

  async save(verification: KycVerification): Promise<void> {
    this.verifications.set(verification.id, verification);
    this.byAccountId.set(verification.accountId, verification.id);
  }

  async update(verification: KycVerification): Promise<void> {
    this.verifications.set(verification.id, verification);
    this.byAccountId.set(verification.accountId, verification.id);
  }

  /** Test helper: seed a verification. */
  seed(verification: KycVerification): void {
    this.verifications.set(verification.id, verification);
    this.byAccountId.set(verification.accountId, verification.id);
  }

  /** Test helper: get all verifications. */
  getAll(): KycVerification[] {
    return [...this.verifications.values()];
  }

  /** Test helper: clear all data. */
  clear(): void {
    this.verifications.clear();
    this.byAccountId.clear();
  }
}
