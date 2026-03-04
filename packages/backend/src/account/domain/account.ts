import { DomainError } from '../../shared/domain/errors.js';

export type AccountStatus = 'pending_verification' | 'active' | 'suspended' | 'deactivated' | 'deleted';

interface AccountProps {
  readonly id: string;
  readonly clerkUserId: string;
  readonly email: string;
  readonly displayName: string | null;
  readonly status: AccountStatus;
  readonly roles: readonly string[];
  readonly onboardingCompleted: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateAccountInput {
  readonly clerkUserId: string;
  readonly email: string;
  readonly displayName?: string | null;
}

export class InvalidAccountDataError extends DomainError {
  constructor(message: string) {
    super('INVALID_ACCOUNT_DATA', message);
    this.name = 'InvalidAccountDataError';
  }
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
      status: 'active',
      roles: ['backer'],
      onboardingCompleted: false,
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

  get status(): AccountStatus {
    return this.props.status;
  }

  get roles(): readonly string[] {
    return this.props.roles;
  }

  get onboardingCompleted(): boolean {
    return this.props.onboardingCompleted;
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
}
