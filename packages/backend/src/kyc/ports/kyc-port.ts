export interface InitiateVerificationResult {
  readonly sessionId: string;
  readonly providerUrl?: string;
}

export type VerificationStatusResult =
  | 'pending'
  | 'approved'
  | 'declined'
  | 'resubmission_requested'
  | 'expired'
  | 'abandoned';

export interface KycPort {
  initiateVerification(accountId: string): Promise<InitiateVerificationResult>;
  getVerificationStatus(sessionId: string): Promise<VerificationStatusResult>;
}
