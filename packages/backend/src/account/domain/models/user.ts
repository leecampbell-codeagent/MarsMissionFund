import {
  AlreadyActiveError,
  BioTooLongError,
  CannotRemoveBackerRoleError,
  DisplayNameTooLongError,
  InvalidAvatarUrlError,
  InvalidClerkUserIdError,
  InvalidEmailError,
  RoleNotAssignedError,
  SecurityAlertsCannotBeDisabledError,
  SuperAdminAssignmentForbiddenError,
} from '../errors/account-errors.js';
import { AccountStatus } from '../value-objects/account-status.js';
import { KycStatus } from '../value-objects/kyc-status.js';
import { NotificationPreferences } from '../value-objects/notification-preferences.js';
import type { OnboardingStep } from '../value-objects/onboarding-step.js';
import { Role } from '../value-objects/role.js';

// Email regex — basic validation (RFC 5322 simplified)
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface UserData {
  readonly id: string;
  readonly clerkUserId: string;
  readonly email: string;
  readonly displayName: string | null;
  readonly bio: string | null;
  readonly avatarUrl: string | null;
  readonly accountStatus: AccountStatus;
  readonly onboardingCompleted: boolean;
  readonly onboardingStep: OnboardingStep | null;
  readonly roles: Role[];
  readonly notificationPrefs: NotificationPreferences;
  readonly kycStatus: KycStatus;
  readonly lastSeenAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateUserInput {
  readonly clerkUserId: string;
  readonly email: string;
  readonly displayName?: string;
  readonly bio?: string;
  readonly avatarUrl?: string;
  readonly accountStatus: AccountStatus;
}

export interface UpdateProfileInput {
  readonly displayName?: string | null;
  readonly bio?: string | null;
  readonly avatarUrl?: string | null;
  readonly onboardingCompleted?: boolean;
  readonly onboardingStep?: OnboardingStep | null;
}

function validateAvatarUrl(url: string): void {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new InvalidAvatarUrlError(url);
    }
  } catch {
    throw new InvalidAvatarUrlError(url);
  }
}

export class User {
  private constructor(private readonly props: UserData) {}

  /**
   * Creates a new User entity with full validation.
   * Throws domain errors for invalid input.
   */
  static create(input: CreateUserInput): User {
    if (!input.clerkUserId || input.clerkUserId.trim() === '') {
      throw new InvalidClerkUserIdError();
    }

    const normalizedEmail = input.email.toLowerCase().trim();
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      throw new InvalidEmailError(input.email);
    }

    if (input.displayName !== undefined && input.displayName !== '') {
      if (input.displayName.length > 255) {
        throw new DisplayNameTooLongError();
      }
    }

    if (input.bio !== undefined && input.bio !== '') {
      if (input.bio.length > 500) {
        throw new BioTooLongError();
      }
    }

    if (input.avatarUrl !== undefined && input.avatarUrl !== '') {
      validateAvatarUrl(input.avatarUrl);
    }

    const now = new Date();

    return new User({
      id: crypto.randomUUID(),
      clerkUserId: input.clerkUserId,
      email: normalizedEmail,
      displayName: input.displayName || null,
      bio: input.bio || null,
      avatarUrl: input.avatarUrl || null,
      accountStatus: input.accountStatus,
      onboardingCompleted: false,
      onboardingStep: null,
      roles: [],
      notificationPrefs: NotificationPreferences.defaults(),
      kycStatus: KycStatus.NotStarted,
      lastSeenAt: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  /**
   * Reconstitutes a User from persistence — no validation.
   * Data is trusted as coming from the database.
   */
  static reconstitute(data: UserData): User {
    return new User(data);
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
  get accountStatus(): AccountStatus {
    return this.props.accountStatus;
  }
  get onboardingCompleted(): boolean {
    return this.props.onboardingCompleted;
  }
  get onboardingStep(): OnboardingStep | null {
    return this.props.onboardingStep;
  }
  get roles(): Role[] {
    return [...this.props.roles];
  }
  get notificationPrefs(): NotificationPreferences {
    return this.props.notificationPrefs;
  }
  get kycStatus(): KycStatus {
    return this.props.kycStatus;
  }
  get lastSeenAt(): Date | null {
    return this.props.lastSeenAt;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  /**
   * Activates the user account, assigning the Backer role if not already present.
   * Throws AlreadyActiveError if already active.
   */
  activate(): User {
    if (this.props.accountStatus === AccountStatus.Active) {
      throw new AlreadyActiveError();
    }

    const roles = this.props.roles.includes(Role.Backer)
      ? this.props.roles
      : [...this.props.roles, Role.Backer];

    return new User({
      ...this.props,
      accountStatus: AccountStatus.Active,
      roles,
      updatedAt: new Date(),
    });
  }

  /**
   * Assigns a role to the user. Returns unchanged User if role already assigned.
   * Throws SuperAdminAssignmentForbiddenError for SuperAdministrator role.
   */
  assignRole(role: Role): User {
    if (role === Role.SuperAdministrator) {
      throw new SuperAdminAssignmentForbiddenError();
    }

    if (this.props.roles.includes(role)) {
      return this; // Idempotent
    }

    return new User({
      ...this.props,
      roles: [...this.props.roles, role],
      updatedAt: new Date(),
    });
  }

  /**
   * Removes a role from the user.
   * Throws CannotRemoveBackerRoleError if removing the only remaining role (Backer).
   * Throws RoleNotAssignedError if user does not have the role.
   */
  removeRole(role: Role): User {
    if (!this.props.roles.includes(role)) {
      throw new RoleNotAssignedError(role);
    }

    if (role === Role.Backer && this.props.roles.length === 1) {
      throw new CannotRemoveBackerRoleError();
    }

    return new User({
      ...this.props,
      roles: this.props.roles.filter((r) => r !== role),
      updatedAt: new Date(),
    });
  }

  /**
   * Updates the user's profile fields.
   * Empty strings are normalised to null.
   */
  updateProfile(input: UpdateProfileInput): User {
    const displayName =
      input.displayName === '' ? null : (input.displayName ?? this.props.displayName);
    const bio = input.bio === '' ? null : (input.bio ?? this.props.bio);
    const avatarUrl = input.avatarUrl === '' ? null : (input.avatarUrl ?? this.props.avatarUrl);

    if (displayName !== null && displayName.length > 255) {
      throw new DisplayNameTooLongError();
    }

    if (bio !== null && bio.length > 500) {
      throw new BioTooLongError();
    }

    if (avatarUrl !== null) {
      validateAvatarUrl(avatarUrl);
    }

    const onboardingCompleted = input.onboardingCompleted ?? this.props.onboardingCompleted;
    const onboardingStep =
      input.onboardingStep !== undefined ? input.onboardingStep : this.props.onboardingStep;

    return new User({
      ...this.props,
      displayName,
      bio,
      avatarUrl,
      onboardingCompleted,
      onboardingStep,
      updatedAt: new Date(),
    });
  }

  /**
   * Merges partial notification preference updates.
   * Throws SecurityAlertsCannotBeDisabledError if securityAlerts is set to false.
   */
  updateNotificationPrefs(prefs: Partial<NotificationPreferences>): User {
    // securityAlerts cannot be set to false — type system + runtime guard
    // Cast through unknown to allow comparison despite the literal true type
    if ('securityAlerts' in prefs && (prefs.securityAlerts as unknown) === false) {
      throw new SecurityAlertsCannotBeDisabledError();
    }

    const merged: NotificationPreferences = {
      ...this.props.notificationPrefs,
      ...prefs,
      securityAlerts: true, // Always forced to true
    };

    return new User({
      ...this.props,
      notificationPrefs: merged,
      updatedAt: new Date(),
    });
  }

  /**
   * Updates lastSeenAt to now.
   */
  touchLastSeen(): User {
    return new User({
      ...this.props,
      lastSeenAt: new Date(),
      updatedAt: new Date(),
    });
  }
}
