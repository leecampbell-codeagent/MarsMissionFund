export interface KycSessionResult {
  readonly sessionId: string;
  readonly outcome: 'approved' | 'declined' | 'pending';
}

export interface KycVerificationPort {
  initiateSession(userId: string): Promise<KycSessionResult>;
}
