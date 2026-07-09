import { z } from "zod";

export const joinMeetingSchema = z.object({
  meetingUrl: z.string().url("Valid meeting URL is required"),
  title: z.string().trim().max(500).optional()
});

export const listMeetingsQuerySchema = z.object({
  status: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional()
});
