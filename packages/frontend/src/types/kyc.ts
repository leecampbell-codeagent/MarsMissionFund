export interface KycStatusData {
  readonly status: string;
  readonly verifiedAt: string | null;
}

export interface KycStatusResponse {
  readonly data: KycStatusData;
}

export interface KycSubmitResponse {
  readonly data: KycStatusData;
}
