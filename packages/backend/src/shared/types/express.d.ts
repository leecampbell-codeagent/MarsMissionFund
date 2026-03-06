import type { AuthContext } from './auth-context.js';

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
      correlationId?: string;
    }
  }
}
