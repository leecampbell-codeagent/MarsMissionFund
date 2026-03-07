import { z } from 'zod';

export const patchMeSchema = z.object({
  display_name: z.string().max(255).nullable().optional(),
  bio: z.string().max(2000).nullable().optional(),
  avatar_url: z.string().url().max(500).nullable().optional(),
});

export type PatchMeBody = z.infer<typeof patchMeSchema>;

export const assignRolesSchema = z.object({
  roles: z.array(z.string()).min(1),
});

export type AssignRolesBody = z.infer<typeof assignRolesSchema>;
