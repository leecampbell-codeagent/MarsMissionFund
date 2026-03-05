/**
 * KYC API types for feat-013.
 * Monetary amounts (none here) would be strings. Status is string union.
 */

export type KycStatus =
  | 'not_verified'
  | 'pending'
  | 'pending_resubmission'
  | 'in_manual_review'
  | 'verified'
  | 'rejected'
  | 'locked'
  | 'expired'
  | 'reverification_required';

export type DocumentType = 'passport' | 'national_id' | 'drivers_licence';

export interface KycStatusResponse {
  readonly id: string;
  readonly accountId: string;
  readonly status: KycStatus;
  readonly documentType: DocumentType | null;
  readonly failureCount: number;
  readonly verifiedAt: string | null;
  readonly submittedAt: string | null;
}

export interface SubmitKycInput {
  readonly document_type: DocumentType;
  readonly front_document_ref?: string | null;
  readonly back_document_ref?: string | null;
}

export interface KycApiResponse {
  readonly data: KycStatusResponse;
}
