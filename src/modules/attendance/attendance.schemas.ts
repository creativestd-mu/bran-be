import { z } from "zod";

export const attendanceListFilterValues = [
  "total",
  "submitted",
  "missing",
  "office",
  "wfh",
  "leave",
  "compOff"
] as const;

export type AttendanceListFilter = (typeof attendanceListFilterValues)[number];

export const attendanceDateQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD")
    .optional(),
  filter: z.enum(attendanceListFilterValues).optional().default("total")
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
    .optional(),
  slackUserId: z.string().min(1).optional()
});

export const updateMemberPodSchema = z.object({
  pod: z.enum(["default", "production"])
});

export const listPersonStatsQuerySchema = z.object({
  actionStatus: z.enum(["none", "flagged", "warned", "acknowledged", "resolved"]).optional(),
  minWfh: z.coerce.number().int().min(0).optional(),
  minLeave: z.coerce.number().int().min(0).optional(),
  minLateSubmission: z.coerce.number().int().min(0).optional(),
  minLateArrival: z.coerce.number().int().min(0).optional(),
  minMissing: z.coerce.number().int().min(0).optional(),
  sortBy: z
    .enum([
      "wfhCount",
      "leaveCount",
      "lateSubmissionCount",
      "lateArrivalCount",
      "missingCount",
      "onTimeCount",
      "userName"
    ])
    .optional(),
  sortDir: z.enum(["asc", "desc"]).optional()
});

export const updatePersonStatsActionSchema = z.object({
  actionStatus: z.enum(["none", "flagged", "warned", "acknowledged", "resolved"]),
  actionNote: z.string().max(5000).nullable().optional()
});

export const userDetailQuerySchema = z.object({
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "from must be YYYY-MM-DD")
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "to must be YYYY-MM-DD")
    .optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional()
});
