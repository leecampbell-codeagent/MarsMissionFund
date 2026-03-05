// WARN-001: use as const + union types instead of TypeScript enums
export const Role = {
  Backer: 'backer',
  Creator: 'creator',
  Reviewer: 'reviewer',
  Administrator: 'administrator',
  SuperAdministrator: 'super_administrator',
} as const;

export type Role = (typeof Role)[keyof typeof Role];









