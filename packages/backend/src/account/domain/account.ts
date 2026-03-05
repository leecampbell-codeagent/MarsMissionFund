import { InvalidAccountDataError, InvalidOnboardingStepError } from '../../shared/domain/errors.js';

export type AccountStatus =
  | 'pending_verification'
  | 'active'
  | 'suspended'
  | 'deactivated'
  | 'deleted';

export type OnboardingStep = 'welcome' | 'role_selection' | 'profile' | 'preferences' | 'completed';

export type AccountRole =
  | 'backer'
  | 'creator'
  | 'reviewer'
  | 'administrator'
  | 'super_administrator';

export interface NotificationPreferences {
  readonly campaign_updates: boolean;
  readonly milestone_completions: boolean;
  readonly contribution_confirmations: boolean;
  readonly new_campaign_recommendations: boolean;
  readonly security_alerts: boolean;
  readonly platform_announcements: boolean;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  campaign_updates: true,
  milestone_completions: true,
  contribution_confirmations: true,
  new_campaign_recommendations: true,
  security_alerts: true,
  platform_announcements: false,
};

const ONBOARDING_STEP_ORDER: readonly OnboardingStep[] = [
  'welcome',
  'role_selection',
  'profile',
  'preferences',
  'completed',
];

const VALID_ACCOUNT_ROLES = new Set<AccountRole>([
  'backer',
  'creator',
  'reviewer',
  'administrator',
  'super_administrator',
]);

interface AccountProps {
  readonly id: string;
  readonly clerkUserId: string;
  readonly email: string;
  readonly displayName: string | null;
  readonly bio: string | null;
  readonly avatarUrl: string | null;
  readonly status: AccountStatus;
  readonly roles: readonly AccountRole[];
  readonly onboardingCompleted: boolean;
  readonly onboardingStep: OnboardingStep;
  readonly notificationPreferences: NotificationPreferences;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateAccountInput {
  readonly clerkUserId: string;
  readonly email: string;
  readonly displayName?: string | null;
}

export class Account {
  private constructor(private readonly props: AccountProps) {}

  /** Creates a new account with full validation. */
  static create(input: CreateAccountInput): Account {
    if (!input.clerkUserId || input.clerkUserId.trim().length === 0) {
      throw new InvalidAccountDataError('clerkUserId must be a non-empty string');
    }

    if (!input.email || input.email.trim().length === 0) {
      throw new InvalidAccountDataError('email must be a non-empty string');
    }

    return new Account({
      id: crypto.randomUUID(),
      clerkUserId: input.clerkUserId,
      email: input.email.toLowerCase(),
      displayName: input.displayName ?? null,
      bio: null,
      avatarUrl: null,
      status: 'active',
      roles: ['backer'],
      onboardingCompleted: false,
      onboardingStep: 'welcome',
      notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  /** Reconstitutes from persistence — no validation (data is already valid). */
  static reconstitute(data: AccountProps): Account {
    return new Account(data);
  }

  get id(): string {
    return this.props.id;
  }

  get clerkUserId(): string {
    return this.props.clerkUserId;
  }

  get email(): string {
    return this.props.email;
  }

  get displayName(): string | null {
    return this.props.displayName;
  }

  get bio(): string | null {
    return this.props.bio;
  }

  get avatarUrl(): string | null {
    return this.props.avatarUrl;
  }

  get status(): AccountStatus {
    return this.props.status;
  }

  get roles(): readonly AccountRole[] {
    return this.props.roles;
  }

  get onboardingCompleted(): boolean {
    return this.props.onboardingCompleted;
  }

  get onboardingStep(): OnboardingStep {
    return this.props.onboardingStep;
  }

  get notificationPreferences(): NotificationPreferences {
    return this.props.notificationPreferences;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  isActive(): boolean {
    return this.props.status === 'active';
  }

  isSuspended(): boolean {
    return this.props.status === 'suspended' || this.props.status === 'deactivated';
  }

  /**
   * Returns a new Account with updated profile fields.
   * Validates display name, bio, and avatar URL.
   */
  withProfile(
    displayName: string | null | undefined,
    bio: string | null | undefined,
    avatarUrl: string | null | undefined,
  ): Account {
    let validatedDisplayName = this.props.displayName;
    let validatedBio = this.props.bio;
    let validatedAvatarUrl = this.props.avatarUrl;

    if (displayName !== undefined) {
      if (displayName !== null) {
        const trimmed = displayName.trim();
        if (trimmed.length === 0) {
          throw new InvalidAccountDataError('Display name must not be empty.');
        }
        if (trimmed.length > 100) {
          throw new InvalidAccountDataError('Display name must be 100 characters or fewer.');
        }
        validatedDisplayName = trimmed;
      } else {
        validatedDisplayName = null;
      }
    }

    if (bio !== undefined) {
      if (bio !== null) {
        const trimmed = bio.trim();
        if (trimmed.length > 500) {
          throw new InvalidAccountDataError('Bio must be 500 characters or fewer.');
        }
        validatedBio = trimmed;
      } else {
        validatedBio = null;
      }
    }

    if (avatarUrl !== undefined) {
      if (avatarUrl !== null) {
        if (!avatarUrl.startsWith('https://')) {
          throw new InvalidAccountDataError('Avatar URL must use HTTPS.');
        }
        validatedAvatarUrl = avatarUrl;
      } else {
        validatedAvatarUrl = null;
      }
    }

    return new Account({
      ...this.props,
      displayName: validatedDisplayName,
      bio: validatedBio,
      avatarUrl: validatedAvatarUrl,
      updatedAt: new Date(),
    });
  }

  /**
   * Returns a new Account with updated roles.
   * Validates that backer is always present and all roles are valid.
   */
  withRoles(roles: readonly AccountRole[]): Account {
    if (roles.length === 0) {
      throw new InvalidAccountDataError('Roles must not be empty.');
    }

    for (const role of roles) {
      if (!VALID_ACCOUNT_ROLES.has(role)) {
        throw new InvalidAccountDataError(`Invalid role: ${role}`);
      }
    }

    if (!roles.includes('backer')) {
      throw new InvalidAccountDataError('backer role must always be present.');
    }

    return new Account({
      ...this.props,
      roles,
      updatedAt: new Date(),
    });
  }

  /**
   * Returns a new Account with advanced onboarding step.
   * Step can only move forward. If step is 'completed', also sets onboardingCompleted to true.
   */
  withOnboardingStep(step: OnboardingStep): Account {
    const currentIndex = ONBOARDING_STEP_ORDER.indexOf(this.props.onboardingStep);
    const newIndex = ONBOARDING_STEP_ORDER.indexOf(step);

    if (newIndex === -1) {
      throw new InvalidOnboardingStepError(`Invalid onboarding step: ${step}`);
    }

    if (newIndex <= currentIndex) {
      throw new InvalidOnboardingStepError(
        `Cannot regress onboarding step from '${this.props.onboardingStep}' to '${step}'.`,
      );
    }

    return new Account({
      ...this.props,
      onboardingStep: step,
      onboardingCompleted: step === 'completed' ? true : this.props.onboardingCompleted,
      updatedAt: new Date(),
    });
  }

  /**
   * Returns a new Account with updated notification preferences.
   * Forces security_alerts to true regardless of input.
   */
  withNotificationPreferences(prefs: NotificationPreferences): Account {
    const validPrefs: NotificationPreferences = {
      ...prefs,
      security_alerts: true,
    };

    return new Account({
      ...this.props,
      notificationPreferences: validPrefs,
      updatedAt: new Date(),
    });
  }

  /**
   * Returns a new Account with display name set from webhook data.
   * Only sets display name if the current value is null.
   */
  withDisplayNameFromWebhook(displayName: string | null): Account {
    if (this.props.displayName !== null) {
      return this;
    }

    return new Account({
      ...this.props,
      displayName,
      updatedAt: new Date(),
    });
  }
}
