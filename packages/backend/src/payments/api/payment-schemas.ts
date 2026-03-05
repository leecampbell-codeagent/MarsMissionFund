import { z } from 'zod';

export const capturePaymentSchema = z.object({
  campaign_id: z.string().uuid(),
  amount_cents: z.number().int().min(100),
  payment_method_token: z.string().min(1),
});

export type CapturePaymentBody = z.infer<typeof capturePaymentSchema>;
