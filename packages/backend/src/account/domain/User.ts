import { Result } from '../../shared/domain/Result';
import { UserValidationError } from './errors/UserValidationError';
import { KycStatus } from './KycStatus';
import type { Role } from './Role';

export interface UserProps {
  id: string;
  clerkId: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  roles: Role[];
  kycStatus: KycStatus;
  onboardingCompleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class User {
  readonly id: string;
  readonly clerkId: string;
  readonly email: string;
  readonly displayName: string | null;
  readonly avatarUrl: string | null;
  readonly bio: string | null;
  readonly roles: Role[];
  readonly kycStatus: KycStatus;
  readonly onboardingCompleted: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(props: UserProps) {
    this.id = props.id;
    this.clerkId = props.clerkId;
    this.email = props.email;
    this.displayName = props.displayName;
    this.avatarUrl = props.avatarUrl;
    this.bio = props.bio;
    this.roles = props.roles;
    this.kycStatus = props.kycStatus;
    this.onboardingCompleted = props.onboardingCompleted;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(props: {
    clerkId: string;
    email: string;
    displayName?: string | null;
    avatarUrl?: string | null;
    bio?: string | null;
  }): Result<User> {
    if (!props.clerkId || props.clerkId.trim().length === 0) {
      return Result.fail(new UserValidationError('clerkId is required and must not be empty.'));
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!props.email || !emailRegex.test(props.email)) {
      return Result.fail(new UserValidationError('A valid email address is required.'));
    }

    const now = new Date();
    const user = new User({
      id: crypto.randomUUID(),
      clerkId: props.clerkId.trim(),
      email: props.email,
      displayName: props.displayName ?? null,
      avatarUrl: props.avatarUrl ?? null,
      bio: props.bio ?? null,
      roles: ['backer'],
      kycStatus: KycStatus.NotVerified,
      onboardingCompleted: false,
      createdAt: now,
      updatedAt: now,
    });

    return Result.ok(user);
  }

  static reconstitute(props: UserProps): User {
    return new User(props);
  }

  hasRole(role: Role): boolean {
    return this.roles.includes(role);
  }

  isAdmin(): boolean {
    return (
      this.hasRole('reviewer') ||
      this.hasRole('administrator') ||
      this.hasRole('super_administrator')
    );
  }
}
