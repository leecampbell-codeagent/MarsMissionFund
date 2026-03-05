import { z } from 'zod';

/**
 * Schema for POST /api/v1/kyc/submit.
 * The body must be an empty object — no user-supplied fields are accepted.
 * Document upload is out of scope for the stub.
 */
export const kycSubmitSchema = z.object({}).strict();
