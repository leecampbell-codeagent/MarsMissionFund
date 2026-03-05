import { z } from 'zod';
import { CAMPAIGN_CATEGORIES } from '../../domain/value-objects/campaign-category.js';

const milestoneSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  description: z.string().max(1000),
  fundingBasisPoints: z.number().int().min(1).max(10000),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const teamMemberSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  role: z.string().trim().min(1).max(200),
  bio: z.string().max(500),
});

const riskDisclosureSchema = z.object({
  id: z.string().uuid(),
  risk: z.string().trim().min(1).max(500),
  mitigation: z.string().trim().min(1).max(500),
});

const budgetItemSchema = z.object({
  id: z.string().uuid(),
  category: z.string().trim().min(1).max(100),
  description: z.string().trim().min(1).max(500),
  estimatedCents: z.string().regex(/^[1-9]\d*$/, 'Must be a positive integer string'),
  notes: z.string().max(200).optional(),
});

// Lenient schema — structural validation only (G-026)
// Business rules (milestone sum = 10000, required fields) are NOT validated here.
export const updateCampaignSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    shortDescription: z.string().trim().max(500).optional(),
    description: z.string().max(10000).optional(),
    category: z
      .enum(CAMPAIGN_CATEGORIES as [string, ...string[]])
      .optional(),
    heroImageUrl: z
      .string()
      .url()
      .startsWith('https://', 'URL must use https://')
      .max(2048)
      .nullable()
      .optional(),
    fundingGoalCents: z
      .string()
      .regex(/^[1-9]\d*$/, 'Must be a positive integer string')
      .optional(),
    fundingCapCents: z
      .string()
      .regex(/^[1-9]\d*$/, 'Must be a positive integer string')
      .optional(),
    deadline: z.string().datetime().optional(),
    milestones: z.array(milestoneSchema).max(10).optional(),
    teamMembers: z.array(teamMemberSchema).max(20).optional(),
    riskDisclosures: z.array(riskDisclosureSchema).max(10).optional(),
    budgetBreakdown: z.array(budgetItemSchema).max(20).optional(),
    alignmentStatement: z.string().max(1000).optional(),
    tags: z.array(z.string().max(50)).max(20).optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;
