import { z } from "zod";

export const createUserKpiSchema = z.object({
  userId: z.string().uuid(),
  title: z.string().trim().min(1).max(500),
  description: z.string().trim().min(1).max(8000),
  sortOrder: z.coerce.number().int().min(0).optional(),
  isActive: z.boolean().optional()
});

export const updateUserKpiSchema = z.object({
  title: z.string().trim().min(1).max(500).optional(),
  description: z.string().trim().min(1).max(8000).optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  isActive: z.boolean().optional()
});

export const listUserKpisQuerySchema = z.object({
  userId: z.string().uuid().optional(),
  isActive: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional()
});
