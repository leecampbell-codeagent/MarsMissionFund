export const ACCOUNT_EVENT_TYPES = {
  PROFILE_UPDATED: 'account.profile_updated',
  ROLES_UPDATED: 'account.roles_updated',
  ONBOARDING_STEP_COMPLETED: 'account.onboarding_step_completed',
  ONBOARDING_COMPLETED: 'account.onboarding_completed',
  PREFERENCES_UPDATED: 'account.preferences_updated',
} as const;

export type AccountEventType = (typeof ACCOUNT_EVENT_TYPES)[keyof typeof ACCOUNT_EVENT_TYPES];

export interface AccountEvent {
  readonly eventType: AccountEventType;
  readonly aggregateId: string; // account ID
  readonly correlationId: string;
  readonly payload: Record<string, unknown>; // no PII — IDs and field names only
}
