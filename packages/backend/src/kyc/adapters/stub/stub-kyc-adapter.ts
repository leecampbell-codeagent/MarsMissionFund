import type { Pool } from 'pg';
import type { Logger } from 'pino';
import { AlreadyVerifiedError } from '../../domain/errors.js';
import type { DocumentType, IKycAdapter, KycVerification } from '../../ports/kyc-adapter.js';

export class StubKycAdapter implements IKycAdapter {
  constructor(
    private readonly pool: Pool,
    private readonly logger: Logger,
  ) {}

  async getStatus(userId: string): Promise<KycVerification | null> {
    const result = await this.pool.query<{
      user_id: string;
      status: string;
      verified_at: Date | null;
      provider_reference: string | null;
    }>(
      `SELECT user_id, status, verified_at, provider_reference
       FROM kyc_verifications
       WHERE user_id = $1`,
      [userId],
    );

    const row = result.rows[0];
    if (!row) return null;

    return {
      userId: row.user_id,
      status: row.status as KycVerification['status'],
      verifiedAt: row.verified_at,
      providerReference: row.provider_reference,
    };
  }

  async submit(input: { userId: string; documentType: DocumentType }): Promise<KycVerification> {
    // Check existing status before writing
    const existing = await this.getStatus(input.userId);
    if (existing?.status === 'verified') {
      throw new AlreadyVerifiedError();
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Step 1: upsert to 'pending'
      await client.query(
        `INSERT INTO kyc_verifications (id, user_id, status, provider_reference, verified_at)
         VALUES (gen_random_uuid(), $1, 'pending', NULL, NULL)
         ON CONFLICT (user_id)
         DO UPDATE SET
           status = 'pending',
           provider_reference = NULL,
           verified_at = NULL,
           updated_at = NOW()`,
        [input.userId],
      );

      // Step 2: immediately transition to 'verified' (stub auto-approval)
      const verifiedResult = await client.query<{
        user_id: string;
        status: string;
        verified_at: Date | null;
        provider_reference: string | null;
      }>(
        `UPDATE kyc_verifications
         SET status = 'verified',
             verified_at = NOW(),
             updated_at = NOW()
         WHERE user_id = $1
         RETURNING user_id, status, verified_at, provider_reference`,
        [input.userId],
      );

      await client.query('COMMIT');

      const row = verifiedResult.rows[0];
      if (!row) {
        throw new Error('KYC upsert returned no row after COMMIT');
      }

      this.logger.info(
        { userId: input.userId, documentType: input.documentType },
        'KYC stub auto-approved',
      );

      return {
        userId: row.user_id,
        status: row.status as KycVerification['status'],
        verifiedAt: row.verified_at,
        providerReference: row.provider_reference,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
