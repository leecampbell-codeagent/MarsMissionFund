export interface WebhookUserData {
  readonly id: string;
  readonly email_addresses: ReadonlyArray<{ readonly email_address: string }>;
  readonly first_name: string | null;
  readonly last_name: string | null;
}

export interface WebhookEvent {
  readonly type: 'user.created' | 'user.updated' | 'user.deleted';
  readonly data: WebhookUserData;
}

export interface WebhookVerificationPort {
  verifyWebhookSignature(payload: string, headers: Record<string, string>): WebhookEvent;
}
