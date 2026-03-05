import { z } from 'zod';

export const createCampaignSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'Title is required')
      .max(200, 'Title must be 200 characters or fewer'),
  })
  .strict();

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
