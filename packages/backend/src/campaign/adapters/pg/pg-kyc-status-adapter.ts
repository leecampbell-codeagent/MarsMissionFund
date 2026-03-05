import type { Pool } from 'pg';
import type { KycStatusPort, KycStatusResult } from '../../ports/kyc-status-port.js';

/**
 * Reads KYC verification status directly from the kyc_verifications table.
 * Returns not_verified if no record exists.
 */
export class PgKycStatusAdapter implements KycStatusPort {
  constructor(private readonly pool: Pool) {}

  async getVerificationStatus(accountId: string): Promise<KycStatusResult> {
    const result = await this.pool.query(
      'SELECT status FROM kyc_verifications WHERE account_id = $1',
      [accountId],
    );

    if (result.rows.length === 0) {
      return { status: 'not_verified' };
    }

    return { status: result.rows[0].status as string };
  }
}
