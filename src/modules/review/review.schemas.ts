import { z } from "zod";

const hhmm = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be HH:mm (24h IST)");

export const createReviewSchema = z
  .object({
    requestedToId: z.string().uuid(),
    context: z.string().trim().min(1).max(8000),
    fileUrl: z.string().trim().url().max(2000).optional().nullable()
  })
  .strict();

export const listReviewsQuerySchema = z.object({
  direction: z.enum(["incoming", "outgoing", "all"]).default("all"),
  status: z.enum(["pending", "accepted", "rejected", "all"]).default("all")
});

export const respondReviewSchema = z
  .object({
    decision: z.enum(["accepted", "rejected"]),
    comment: z.string().trim().min(1).max(4000)
  })
  .strict();

export const updateReminderPreferencesSchema = z
  .object({
    times: z.array(hhmm).min(1).max(8),
    enabled: z.boolean()
  })
  .strict();

export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type ListReviewsQuery = z.infer<typeof listReviewsQuerySchema>;
export type RespondReviewInput = z.infer<typeof respondReviewSchema>;
export type UpdateReminderPreferencesInput = z.infer<typeof updateReminderPreferencesSchema>;
