export interface ClerkUserMetadata {
  readonly clerkUserId: string;
  readonly email: string;
  readonly emailVerified: boolean;
  readonly firstName: string | null;
  readonly lastName: string | null;
}

export interface ClerkAuthPort {
  getUserMetadata(clerkUserId: string): Promise<ClerkUserMetadata>;
  setPublicMetadata(clerkUserId: string, metadata: { role: string }): Promise<void>;
}
