import { z } from "zod";

const dateOrDateTime = z
  .string()
  .refine((value) => !Number.isNaN(new Date(value).getTime()), "Invalid date");

export const syncEarnedBodySchema = z.object({
  from: dateOrDateTime.optional(),
  to: dateOrDateTime.optional(),
  searchIds: z.array(z.string().min(1)).min(1).optional()
});

export const earnedRangeQuerySchema = z.object({
  from: dateOrDateTime.optional(),
  to: dateOrDateTime.optional(),
  searchId: z.string().min(1).optional()
});
