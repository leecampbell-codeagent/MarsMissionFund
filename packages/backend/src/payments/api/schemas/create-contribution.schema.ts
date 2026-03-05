import { z } from 'zod';

export const createContributionSchema = z
  .object({
    campaignId: z.string().uuid({ message: 'campaignId must be a valid UUID.' }),

    // amountCents: accepts string OR number (Zod coerces number → string then parses)
    // Must represent a positive integer >= 500 (minimum $5.00)
    amountCents: z
      .union([z.string(), z.number()])
      .transform((val) => {
        const parsed = typeof val === 'number' ? val : parseInt(val, 10);
        return parsed;
      })
      .pipe(
        z
          .number()
          .int({ message: 'amountCents must be an integer.' })
          .min(500, { message: 'Minimum contribution is $5.00 (500 cents).' }),
      ),

    paymentToken: z
      .string()
      .min(1, { message: 'Payment token is required.' })
      .max(500, { message: 'Payment token must be 500 characters or fewer.' }),
  })
  .strict();

export type CreateContributionInput = z.infer<typeof createContributionSchema>;
