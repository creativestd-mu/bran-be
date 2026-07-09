import { z } from "zod";

export const attendanceDateQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD")
    .optional()
});

export const attendanceCheckBodySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD")
    .optional(),
  sendReminders: z.boolean().optional().default(false)
});

export const attendanceRemindBodySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD")
    .optional()
});

export const updateMemberPodSchema = z.object({
  pod: z.enum(["default", "production"])
});
