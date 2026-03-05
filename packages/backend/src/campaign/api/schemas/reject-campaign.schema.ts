import { z } from 'zod';

export const rejectCampaignSchema = z
  .object({
    rejectionReason: z.string().trim().min(1, 'Rejection reason is required'),
    resubmissionGuidance: z.string().trim().min(1, 'Resubmission guidance is required'),
  })
  .strict();

export type RejectCampaignInput = z.infer<typeof rejectCampaignSchema>;
