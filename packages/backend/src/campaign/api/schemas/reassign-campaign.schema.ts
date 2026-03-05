import { z } from 'zod';

export const reassignCampaignSchema = z
  .object({
    reviewerUserId: z.string().uuid('Must be a valid UUID'),
  })
  .strict();

export type ReassignCampaignInput = z.infer<typeof reassignCampaignSchema>;
