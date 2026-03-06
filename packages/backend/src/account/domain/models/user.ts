import type { NotificationPreferences } from '../value-objects/notification-preferences.js';

export type AccountStatus =
  | 'pending_verification'
  | 'active'
  | 'suspended'
  | 'deactivated'
  | 'deleted';

export interface UserData {
  readonly id: string;
  readonly clerkUserId: string;
  readonly email: string;
  readonly displayName: string | null;
  readonly avatarUrl: string | null;
  readonly bio: string | null;
  readonly accountStatus: AccountStatus;
  readonly onboardingCompleted: boolean;
  readonly onboardingStep: number | null;
  readonly notificationPreferences: NotificationPreferences;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export class User {
  private constructor(
    private readonly data: UserData,
    readonly roles: string[],
  ) {}

  static reconstitute(data: UserData, roles: string[]): User {
    return new User(data, roles);
  }

  get id(): string {
    return this.data.id;
  }

  get clerkUserId(): string {
    return this.data.clerkUserId;
  }

  get email(): string {
    return this.data.email;
  }

  get displayName(): string | null {
    return this.data.displayName;
  }

  get avatarUrl(): string | null {
    return this.data.avatarUrl;
  }

  get bio(): string | null {
    return this.data.bio;
  }

  get accountStatus(): AccountStatus {
    return this.data.accountStatus;
  }

  get onboardingCompleted(): boolean {
    return this.data.onboardingCompleted;
  }

  get onboardingStep(): number | null {
    return this.data.onboardingStep;
  }

  get notificationPreferences(): NotificationPreferences {
    return this.data.notificationPreferences;
  }

  get createdAt(): Date {
    return this.data.createdAt;
  }

  get updatedAt(): Date {
    return this.data.updatedAt;
  }
}
