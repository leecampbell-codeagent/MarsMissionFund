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
  readonly accountStatus: AccountStatus;
  readonly onboardingCompleted: boolean;
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

  get accountStatus(): AccountStatus {
    return this.data.accountStatus;
  }

  get onboardingCompleted(): boolean {
    return this.data.onboardingCompleted;
  }

  get createdAt(): Date {
    return this.data.createdAt;
  }

  get updatedAt(): Date {
    return this.data.updatedAt;
  }
}
