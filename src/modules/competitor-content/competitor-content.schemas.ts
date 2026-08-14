import { z } from "zod";

const dateOrDateTime = z
  .string()
  .refine((value) => !Number.isNaN(new Date(value).getTime()), "Invalid date");

export const syncCompetitorContentBodySchema = z.object({
  from: dateOrDateTime.optional(),
  to: dateOrDateTime.optional(),
  searchIds: z.array(z.string().min(1)).min(1).optional()
});

export const competitorContentQuerySchema = z.object({
  from: dateOrDateTime.optional(),
  to: dateOrDateTime.optional(),
  searchId: z.string().min(1).optional(),
  topN: z
    .string()
    .optional()
    .transform((value) => {
      if (!value) {
        return undefined;
      }
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.floor(parsed), 25) : undefined;
    })
});
