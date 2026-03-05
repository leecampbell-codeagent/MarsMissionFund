import { z } from 'zod';

export const approveCampaignSchema = z
  .object({
    reviewNotes: z.string().trim().min(1, 'Approval notes are required'),
  })
  .strict();

export type ApproveCampaignInput = z.infer<typeof approveCampaignSchema>;
