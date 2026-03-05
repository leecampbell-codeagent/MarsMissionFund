import type { Pool } from 'pg';
import { KycVerification, type DocumentType, type KycStatus } from '../../domain/kyc-verification.js';
import type { KycRepository } from '../../ports/kyc-repository.js';

export class PgKycRepository implements KycRepository {
  constructor(private readonly pool: Pool) {}

  async findByAccountId(accountId: string): Promise<KycVerification | null> {
    const result = await this.pool.query(
      'SELECT * FROM kyc_verifications WHERE account_id = $1',
      [accountId],
    );
    if (result.rows.length === 0) return null;
    return this.toDomain(result.rows[0]);
  }

  async findById(id: string): Promise<KycVerification | null> {
    const result = await this.pool.query(
      'SELECT * FROM kyc_verifications WHERE id = $1',
      [id],
    );
    if (result.rows.length === 0) return null;
    return this.toDomain(result.rows[0]);
  }

  async save(verification: KycVerification): Promise<void> {
    await this.pool.query(
      `INSERT INTO kyc_verifications (
        id, account_id, status, document_type, provider_reference,
        front_document_ref, back_document_ref,
        failure_count, verified_at, expires_at, submitted_at,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        verification.id,
        verification.accountId,
        verification.status,
        verification.documentType,
        verification.providerReference,
        verification.frontDocumentRef,
        verification.backDocumentRef,
        verification.failureCount,
        verification.verifiedAt,
        verification.expiresAt,
        verification.submittedAt,
        verification.createdAt,
        verification.updatedAt,
      ],
    );
  }

  async update(verification: KycVerification): Promise<void> {
    await this.pool.query(
      `UPDATE kyc_verifications SET
        status = $2,
        document_type = $3,
        provider_reference = $4,
        front_document_ref = $5,
        back_document_ref = $6,
        failure_count = $7,
        verified_at = $8,
        expires_at = $9,
        submitted_at = $10,
        updated_at = $11
      WHERE id = $1`,
      [
        verification.id,
        verification.status,
        verification.documentType,
        verification.providerReference,
        verification.frontDocumentRef,
        verification.backDocumentRef,
        verification.failureCount,
        verification.verifiedAt,
        verification.expiresAt,
        verification.submittedAt,
        verification.updatedAt,
      ],
    );
  }

  private toDomain(row: Record<string, unknown>): KycVerification {
    return KycVerification.reconstitute({
      id: row.id as string,
      accountId: row.account_id as string,
      status: row.status as KycStatus,
      documentType: (row.document_type as DocumentType) ?? null,
      providerReference: (row.provider_reference as string) ?? null,
      frontDocumentRef: (row.front_document_ref as string) ?? null,
      backDocumentRef: (row.back_document_ref as string) ?? null,
      failureCount: Number(row.failure_count),
      verifiedAt: row.verified_at ? new Date(row.verified_at as string) : null,
      expiresAt: row.expires_at ? new Date(row.expires_at as string) : null,
      submittedAt: row.submitted_at ? new Date(row.submitted_at as string) : null,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    });
  }
}
