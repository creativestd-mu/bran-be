import { z } from "zod";

import { POD_SOCIAL_KINDS, POD_SOCIAL_PLATFORMS } from "./pods.constants";

export const createPodSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  verticalId: z.string().uuid(),
  headUserId: z.string().uuid(),
  isActive: z.boolean().optional()
});

export const updatePodSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  verticalId: z.string().uuid().optional(),
  headUserId: z.string().uuid().optional(),
  isActive: z.boolean().optional()
});

export const createPodAccountSchema = z.object({
  kind: z.enum(POD_SOCIAL_KINDS),
  platform: z.enum(POD_SOCIAL_PLATFORMS),
  handle: z.string().min(1),
  url: z.string().url().optional(),
  platformAccountId: z.string().min(1).optional(),
  isActive: z.boolean().optional()
});

export const updatePodAccountSchema = z.object({
  kind: z.enum(POD_SOCIAL_KINDS).optional(),
  platform: z.enum(POD_SOCIAL_PLATFORMS).optional(),
  handle: z.string().min(1).optional(),
  url: z.string().url().optional(),
  platformAccountId: z.string().min(1).nullable().optional(),
  isActive: z.boolean().optional()
});

export const listPodAccountsQuerySchema = z.object({
  kind: z.enum(POD_SOCIAL_KINDS).optional(),
  platform: z.enum(POD_SOCIAL_PLATFORMS).optional(),
  isActive: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === "true"))
});

export const listPodPostsQuerySchema = z.object({
  accountId: z.string().uuid().optional(),
  kind: z.enum(POD_SOCIAL_KINDS).optional(),
  platform: z.enum(POD_SOCIAL_PLATFORMS).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().positive().max(200).optional()
});
