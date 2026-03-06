export interface ClerkUserInfo {
  readonly email: string;
  readonly firstName?: string;
}

export interface ClerkPort {
  getUser(clerkUserId: string): Promise<ClerkUserInfo>;
}
