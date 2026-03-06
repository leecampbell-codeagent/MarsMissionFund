export interface AuthContext {
  readonly userId: string;
  readonly clerkUserId: string;
  readonly email: string;
  readonly roles: string[];
}
