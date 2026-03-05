// WARN-001: use as const + union types instead of TypeScript enums
export const OnboardingStep = {
  RoleSelection: 'role_selection',
  Profiling: 'profiling',
  Notifications: 'notifications',
  Complete: 'complete',
} as const;

export type OnboardingStep = (typeof OnboardingStep)[keyof typeof OnboardingStep];




























