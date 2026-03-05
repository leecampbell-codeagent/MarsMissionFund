// Auth context types — augment Express Request
declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        sessionClaims?: Record<string, unknown>;
      };
      correlationId?: string;
    }
  }
}

export {};




























