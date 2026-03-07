export const Role = {
  Backer: 'backer',
  Creator: 'creator',
  Reviewer: 'reviewer',
  Administrator: 'administrator',
  SuperAdministrator: 'super_administrator',
} as const;

export type Role = (typeof Role)[keyof typeof Role];

export const ALL_ROLES: Role[] = Object.values(Role);

export const ADMIN_ROLES: Role[] = [Role.Reviewer, Role.Administrator, Role.SuperAdministrator];
