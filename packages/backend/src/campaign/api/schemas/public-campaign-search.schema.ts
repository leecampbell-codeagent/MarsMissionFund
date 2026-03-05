import { z } from 'zod';
import { CAMPAIGN_CATEGORIES } from '../../domain/value-objects/campaign-category.js';

export const PUBLIC_SORT_OPTIONS = ['newest', 'ending_soon', 'most_funded', 'least_funded'] as const;
export const PUBLIC_STATUS_FILTERS = ['active', 'funded', 'ending_soon'] as const;

export const publicCampaignSearchSchema = z.object({
  q: z
    .string()
    .max(200, 'Search term must not exceed 200 characters')
    .optional()
    .transform((v) => v?.trim() ?? ''),
  category: z
    .union([
      z.enum(CAMPAIGN_CATEGORIES as [string, ...string[]]),
      z.array(z.enum(CAMPAIGN_CATEGORIES as [string, ...string[]])),
    ])
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined;
      return Array.isArray(v) ? v : [v];
    }),
  status: z.enum(PUBLIC_STATUS_FILTERS).optional(),
  sort: z.enum(PUBLIC_SORT_OPTIONS).optional(),
  limit: z
    .string()
    .optional()
    .transform((v) => (v !== undefined ? parseInt(v, 10) : 20))
    .pipe(z.number().int().min(1).max(100, 'limit must not exceed 100')),
  offset: z
    .string()
    .optional()
    .transform((v) => (v !== undefined ? parseInt(v, 10) : 0))
    .pipe(z.number().int().min(0, 'offset must be non-negative')),
});

export type PublicCampaignSearchQuery = z.infer<typeof publicCampaignSearchSchema>;

export const categoryStatsQuerySchema = z.object({
  category: z.enum(CAMPAIGN_CATEGORIES as [string, ...string[]], {
    required_error: 'category is required',
    invalid_type_error: 'category must be one of the valid campaign categories',
  }),
});

export type CategoryStatsQuery = z.infer<typeof categoryStatsQuerySchema>;
