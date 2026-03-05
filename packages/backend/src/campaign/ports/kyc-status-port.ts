export interface KycStatusResult {
  readonly status: string;
}

export interface KycStatusPort {
  getVerificationStatus(accountId: string): Promise<KycStatusResult>;
}
