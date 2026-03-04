import type { RequestHandler } from 'express';

export interface AuthPayload {
  readonly clerkUserId: string;
  readonly sessionId: string;
}

export interface AuthPort {
  verifyToken(token: string): Promise<AuthPayload | null>;
  getMiddleware(): RequestHandler;
}
