// WARN-001: use as const + union types instead of enums
export const AuditActions = {
  ProfileUpdated: 'profile.updated',
  NotificationsUpdated: 'notifications.updated',
  RoleAssigned: 'role.assigned',
  RoleRemoved: 'role.removed',
  AccountActivated: 'account.activated',
  AccountSuspended: 'account.suspended',
  UserSynced: 'user.synced',
} as const;

export type AuditAction = (typeof AuditActions)[keyof typeof AuditActions];

export interface AuditEntry {
  readonly timestamp: Date;
  readonly actorClerkUserId: string;
  readonly action: AuditAction;
  readonly resourceType: 'user';
  readonly resourceId: string; // MMF users.id (UUID)
  readonly metadata?: Record<string, unknown>;
}

export interface AuditLoggerPort {
  log(entry: AuditEntry): Promise<void>;
}




























