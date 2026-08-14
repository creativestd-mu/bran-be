import { z } from "zod";

const dateOrDateTime = z
  .string()
  .refine((value) => !Number.isNaN(new Date(value).getTime()), "Invalid date");

export const sentimentRangeQuerySchema = z.object({
  from: dateOrDateTime.optional(),
  to: dateOrDateTime.optional(),
  searchId: z.string().min(1).optional(),
  preset: z.enum(["7d", "14d", "30d", "this_week", "this_month"]).optional()
});

export const sentimentSyncBodySchema = z.object({
  from: dateOrDateTime.optional(),
  to: dateOrDateTime.optional(),
  searchIds: z.array(z.string().min(1)).min(1).optional()
});
