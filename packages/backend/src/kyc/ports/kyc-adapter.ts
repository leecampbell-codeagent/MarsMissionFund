export type KycStatus =
  | 'not_verified'
  | 'pending'
  | 'pending_resubmission'
  | 'in_manual_review'
  | 'verified'
  | 'expired'
  | 're_verification_required'
  | 'rejected'
  | 'locked';

export type DocumentType = 'passport' | 'national_id' | 'drivers_licence';

export interface KycVerification {
  readonly userId: string;
  readonly status: KycStatus;
  readonly verifiedAt: Date | null;
  readonly providerReference: string | null;
}

export interface SubmitKycInput {
  readonly userId: string;
  readonly documentType: DocumentType;
}

export interface IKycAdapter {
  getStatus(userId: string): Promise<KycVerification | null>;
  submit(input: SubmitKycInput): Promise<KycVerification>;
}
