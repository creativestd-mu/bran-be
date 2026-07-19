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

/** Temporary force-send reminder kinds for FE test buttons (ignore real entry state). */
export const attendanceTestRemindKinds = [
  "missing",
  "wfh_pending",
  "leave_pending",
  "wfh_approved",
  "wfh_denied",
  "leave_approved",
  "leave_denied"
] as const;

export type AttendanceTestRemindKind = (typeof attendanceTestRemindKinds)[number];

export const attendanceTestRemindBodySchema = z.object({
  kind: z.enum(attendanceTestRemindKinds)
  // Recipient is always ATTENDANCE_TEST_EMAIL from env — FE must not pass email.
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

const nonNegInt = z.coerce.number().int().min(0).max(100_000);

/** Set rolling counters to exact values (baselines; history kept). */
export const setPersonStatsCountsSchema = z.object({
  wfhApproved: nonNegInt,
  wfhDenied: nonNegInt,
  wfhPending: nonNegInt.default(0),
  leaveApproved: nonNegInt,
  leaveDenied: nonNegInt,
  leavePending: nonNegInt.default(0),
  missing: nonNegInt,
  onTime: nonNegInt,
  lateSubmission: nonNegInt,
  lateArrival: nonNegInt
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

/** Markdown body for leave / WFH / ETA policies + approval SOPs. */
export const updateAttendancePolicySchema = z.object({
  bodyMd: z.string().max(100_000)
});
