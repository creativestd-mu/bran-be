import { prisma } from "../../lib/prisma";
import { entryDateFromString, formatEntryDate } from "./attendance.dates";

export type UpsertSubmittedInput = {
  slackUserId: string;
  userEmail: string | null;
  userName: string | null;
  entryDate: string;
  etaText: string | null;
  etaMinutes: number | null;
  recordType: string;
  submittedAt: Date;
  submittedOnTime: boolean | null;
  isLateArrival: boolean | null;
  rawMessage: string;
  slackMessageTs: string;
};

export async function upsertSubmittedEntry(input: UpsertSubmittedInput) {
  const entryDate = entryDateFromString(input.entryDate);

  return prisma.etaEntry.upsert({
    where: {
      slackUserId_entryDate: {
        slackUserId: input.slackUserId,
        entryDate
      }
    },
    create: {
      slackUserId: input.slackUserId,
      userEmail: input.userEmail,
      userName: input.userName,
      entryDate,
      etaText: input.etaText,
      etaMinutes: input.etaMinutes,
      status: "submitted",
      recordType: input.recordType,
      submittedAt: input.submittedAt,
      submittedOnTime: input.submittedOnTime,
      isLateArrival: input.isLateArrival,
      rawMessage: input.rawMessage,
      slackMessageTs: input.slackMessageTs,
      wfhApprovalState: input.recordType === "wfh" ? "pending" : null
    },
    update: {
      userEmail: input.userEmail,
      userName: input.userName,
      etaText: input.etaText,
      etaMinutes: input.etaMinutes,
      status: "submitted",
      recordType: input.recordType,
      submittedAt: input.submittedAt,
      submittedOnTime: input.submittedOnTime,
      isLateArrival: input.isLateArrival,
      rawMessage: input.rawMessage,
      slackMessageTs: input.slackMessageTs,
      ...(input.recordType === "wfh"
        ? {}
        : {
            wfhApprovalState: null,
            wfhApprovedAt: null,
            wfhApprovedBySlackUserId: null,
            wfhApprovalNote: null
          })
    }
  });
}

export async function bulkUpsertSubmittedEntries(entries: UpsertSubmittedInput[]): Promise<number> {
  if (entries.length === 0) return 0;

  // Prefer one-by-one upserts via Prisma for correctness; batch in a transaction.
  await prisma.$transaction(
    entries.map((input) => {
      const entryDate = entryDateFromString(input.entryDate);
      return prisma.etaEntry.upsert({
        where: {
          slackUserId_entryDate: {
            slackUserId: input.slackUserId,
            entryDate
          }
        },
          create: {
          slackUserId: input.slackUserId,
          userEmail: input.userEmail,
          userName: input.userName,
          entryDate,
          etaText: input.etaText,
          etaMinutes: input.etaMinutes,
          status: "submitted",
          recordType: input.recordType,
          submittedAt: input.submittedAt,
          submittedOnTime: input.submittedOnTime,
          isLateArrival: input.isLateArrival,
          rawMessage: input.rawMessage,
          slackMessageTs: input.slackMessageTs,
          wfhApprovalState: input.recordType === "wfh" ? "pending" : null
        },
        update: {
          userEmail: input.userEmail,
          userName: input.userName,
          etaText: input.etaText,
          etaMinutes: input.etaMinutes,
          status: "submitted",
          recordType: input.recordType,
          submittedAt: input.submittedAt,
          submittedOnTime: input.submittedOnTime,
          isLateArrival: input.isLateArrival,
          rawMessage: input.rawMessage,
          slackMessageTs: input.slackMessageTs,
          ...(input.recordType === "wfh"
            ? {}
            : {
                wfhApprovalState: null,
                wfhApprovedAt: null,
                wfhApprovedBySlackUserId: null,
                wfhApprovalNote: null
              })
        }
      });
    })
  );

  return entries.length;
}

export async function cleanupStaleMissingEntries(dateStr: string): Promise<number> {
  const entryDate = entryDateFromString(dateStr);

  const submitted = await prisma.etaEntry.findMany({
    where: { entryDate, status: "submitted" },
    select: { slackUserId: true }
  });

  const submittedIds = submitted
    .map((row) => row.slackUserId)
    .filter((id): id is string => Boolean(id));

  if (submittedIds.length === 0) return 0;

  const result = await prisma.etaEntry.deleteMany({
    where: {
      entryDate,
      status: "missing",
      slackUserId: { in: submittedIds }
    }
  });

  return result.count;
}

export async function findEntriesForDate(dateStr: string) {
  return prisma.etaEntry.findMany({
    where: { entryDate: entryDateFromString(dateStr) },
    orderBy: [{ userName: "asc" }, { id: "asc" }]
  });
}

/** Entries for users within an inclusive YYYY-MM-DD date range. */
export async function findEntriesForUsersInDateRange(
  slackUserIds: string[],
  startDate: string,
  endDate: string
) {
  if (slackUserIds.length === 0) return [];

  return prisma.etaEntry.findMany({
    where: {
      slackUserId: { in: slackUserIds },
      entryDate: {
        gte: entryDateFromString(startDate),
        lte: entryDateFromString(endDate)
      }
    },
    select: {
      slackUserId: true,
      status: true,
      recordType: true
    }
  });
}

export async function findSubmittedUserIdsForDate(dateStr: string): Promise<Set<string>> {
  const rows = await prisma.etaEntry.findMany({
    where: {
      entryDate: entryDateFromString(dateStr),
      status: "submitted"
    },
    select: { slackUserId: true }
  });

  return new Set(
    rows.map((r) => r.slackUserId).filter((id): id is string => Boolean(id))
  );
}

export async function upsertMissingEntry(input: {
  slackUserId: string;
  userEmail: string | null;
  userName: string | null;
  entryDate: string;
}) {
  const entryDate = entryDateFromString(input.entryDate);

  const existing = await prisma.etaEntry.findUnique({
    where: {
      slackUserId_entryDate: {
        slackUserId: input.slackUserId,
        entryDate
      }
    }
  });

  if (existing?.status === "submitted") {
    return existing;
  }

  if (existing) {
    return existing;
  }

  return prisma.etaEntry.create({
    data: {
      slackUserId: input.slackUserId,
      userEmail: input.userEmail,
      userName: input.userName,
      entryDate,
      status: "missing",
      recordType: null
    }
  });
}

export async function findMissingEntries(dateStr: string) {
  return prisma.etaEntry.findMany({
    where: {
      entryDate: entryDateFromString(dateStr),
      status: "missing"
    }
  });
}

export async function markReminderSent(
  id: number,
  meta?: { channelId?: string | null; slackTs?: string | null }
) {
  return prisma.etaEntry.update({
    where: { id },
    data: {
      reminderSentAt: new Date(),
      ...(meta?.channelId !== undefined ? { reminderChannelId: meta.channelId } : {}),
      ...(meta?.slackTs !== undefined ? { reminderSlackTs: meta.slackTs } : {})
    }
  });
}

export async function findEntryById(id: number) {
  return prisma.etaEntry.findUnique({ where: { id } });
}

export async function findEntryByReminderChannel(channelId: string, dateStr: string) {
  return prisma.etaEntry.findFirst({
    where: {
      reminderChannelId: channelId,
      entryDate: entryDateFromString(dateStr)
    },
    orderBy: { reminderSentAt: "desc" }
  });
}

export async function findEntryBySlackMessageTs(slackMessageTs: string) {
  return prisma.etaEntry.findFirst({
    where: { slackMessageTs }
  });
}

export async function findMissingEntryForUser(dateStr: string, slackUserId: string) {
  return prisma.etaEntry.findFirst({
    where: {
      entryDate: entryDateFromString(dateStr),
      slackUserId,
      status: "missing"
    }
  });
}

export async function applyWfhApproval(input: {
  entryId: number;
  state: "approved" | "denied" | "pending";
  approvedBySlackUserId?: string | null;
  note?: string | null;
  /** When approving a missing entry, also mark it submitted as WFH. */
  markSubmittedAsWfh?: boolean;
  userEmail?: string | null;
  userName?: string | null;
}) {
  const approvedAt = input.state === "approved" ? new Date() : null;

  return prisma.etaEntry.update({
    where: { id: input.entryId },
    data: {
      wfhApprovalState: input.state,
      wfhApprovedAt: approvedAt,
      wfhApprovedBySlackUserId: input.approvedBySlackUserId ?? null,
      wfhApprovalNote: input.note ?? null,
      ...(input.markSubmittedAsWfh && input.state === "approved"
        ? {
            status: "submitted",
            recordType: "wfh",
            submittedAt: new Date(),
            etaText: null,
            etaMinutes: null,
            isLateArrival: false,
            ...(input.userEmail !== undefined ? { userEmail: input.userEmail } : {}),
            ...(input.userName !== undefined ? { userName: input.userName } : {})
          }
        : {})
    }
  });
}

export async function upsertSlackMember(input: {
  slackUserId: string;
  name: string | null;
  email: string | null;
  realName: string | null;
  isBot: boolean;
  isDeleted: boolean;
}) {
  return prisma.slackMember.upsert({
    where: { slackUserId: input.slackUserId },
    create: {
      slackUserId: input.slackUserId,
      name: input.name,
      email: input.email,
      realName: input.realName,
      isBot: input.isBot,
      isDeleted: input.isDeleted,
      syncedAt: new Date(),
      pod: "default"
    },
    update: {
      name: input.name,
      email: input.email,
      realName: input.realName,
      isBot: input.isBot,
      isDeleted: input.isDeleted,
      syncedAt: new Date()
    }
  });
}

export async function findSlackMember(slackUserId: string) {
  return prisma.slackMember.findUnique({ where: { slackUserId } });
}

export async function listActiveSlackMembers() {
  return prisma.slackMember.findMany({
    where: { isBot: false, isDeleted: false }
  });
}

export function serializeEntry(entry: {
  id: number;
  slackUserId: string | null;
  userEmail: string | null;
  userName: string | null;
  entryDate: Date;
  etaText: string | null;
  etaMinutes: number | null;
  status: string;
  recordType: string | null;
  submittedAt: Date | null;
  submittedOnTime: boolean | null;
  isLateArrival: boolean | null;
  rawMessage: string | null;
  slackMessageTs: string | null;
  reminderSentAt: Date | null;
  wfhApprovalState?: string | null;
  wfhApprovedAt?: Date | null;
  wfhApprovedBySlackUserId?: string | null;
  wfhApprovalNote?: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: entry.id,
    slackUserId: entry.slackUserId,
    userEmail: entry.userEmail,
    userName: entry.userName,
    entryDate: formatEntryDate(entry.entryDate),
    etaText: entry.etaText,
    etaMinutes: entry.etaMinutes,
    status: entry.status,
    recordType: entry.recordType,
    submittedAt: entry.submittedAt?.toISOString() ?? null,
    submittedOnTime: entry.submittedOnTime,
    isLateArrival: entry.isLateArrival,
    rawMessage: entry.rawMessage,
    slackMessageTs: entry.slackMessageTs,
    reminderSentAt: entry.reminderSentAt?.toISOString() ?? null,
    wfhApprovalState: entry.wfhApprovalState ?? null,
    wfhApprovedAt: entry.wfhApprovedAt?.toISOString() ?? null,
    wfhApprovedBySlackUserId: entry.wfhApprovedBySlackUserId ?? null,
    wfhApprovalNote: entry.wfhApprovalNote ?? null,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
    badge: deriveBadge(entry)
  };
}

export function deriveBadge(entry: {
  status: string;
  recordType: string | null;
  submittedOnTime: boolean | null;
  isLateArrival: boolean | null;
  wfhApprovalState?: string | null;
}): string {
  if (entry.status === "missing") return "missing";
  if (entry.recordType === "wfh") {
    if (entry.wfhApprovalState === "approved") return "wfh_approved";
    if (entry.wfhApprovalState === "denied") return "wfh_denied";
    if (entry.wfhApprovalState === "pending") return "wfh_pending";
    return "wfh";
  }
  if (entry.recordType === "leave") return "leave";
  if (entry.recordType === "comp_off") return "comp_off";
  if (entry.isLateArrival) return "late_arrival";
  if (entry.submittedOnTime === false) return "late_submission";
  if (entry.submittedOnTime === true) return "on_time";
  if (entry.recordType === "office") return "office";
  return "submitted";
}

export const ATTENDANCE_ACTION_STATUSES = [
  "none",
  "flagged",
  "warned",
  "acknowledged",
  "resolved"
] as const;

export type AttendanceActionStatus = (typeof ATTENDANCE_ACTION_STATUSES)[number];

type StatsCounters = {
  wfhCount: number;
  leaveCount: number;
  compOffCount: number;
  officeCount: number;
  onTimeCount: number;
  lateSubmissionCount: number;
  lateArrivalCount: number;
  missingCount: number;
  submittedCount: number;
  lastEntryDate: Date | null;
  userEmail: string | null;
  userName: string | null;
};

function emptyCounters(): StatsCounters {
  return {
    wfhCount: 0,
    leaveCount: 0,
    compOffCount: 0,
    officeCount: 0,
    onTimeCount: 0,
    lateSubmissionCount: 0,
    lateArrivalCount: 0,
    missingCount: 0,
    submittedCount: 0,
    lastEntryDate: null,
    userEmail: null,
    userName: null
  };
}

function accumulateEntry(
  counters: StatsCounters,
  entry: {
    status: string;
    recordType: string | null;
    submittedOnTime: boolean | null;
    isLateArrival: boolean | null;
    entryDate: Date;
    userEmail: string | null;
    userName: string | null;
  }
): void {
  if (entry.userEmail) counters.userEmail = entry.userEmail;
  if (entry.userName) counters.userName = entry.userName;

  if (
    !counters.lastEntryDate ||
    entry.entryDate.getTime() > counters.lastEntryDate.getTime()
  ) {
    counters.lastEntryDate = entry.entryDate;
  }

  if (entry.status === "missing") {
    counters.missingCount += 1;
    return;
  }

  counters.submittedCount += 1;

  if (entry.recordType === "wfh") counters.wfhCount += 1;
  else if (entry.recordType === "leave") counters.leaveCount += 1;
  else if (entry.recordType === "comp_off") counters.compOffCount += 1;
  else if (entry.recordType === "office") counters.officeCount += 1;

  if (entry.submittedOnTime === true) counters.onTimeCount += 1;
  if (entry.submittedOnTime === false) counters.lateSubmissionCount += 1;
  if (entry.isLateArrival === true) counters.lateArrivalCount += 1;
}

async function resolveUserIdByEmail(email: string | null): Promise<string | null> {
  if (!email) return null;
  const user = await prisma.user.findFirst({
    where: {
      isActive: true,
      email: { equals: email, mode: "insensitive" }
    },
    select: { id: true }
  });
  return user?.id ?? null;
}

/** Recompute one person's rolling stats from all eta_entries. */
export async function recomputePersonStats(slackUserId: string) {
  const entries = await prisma.etaEntry.findMany({
    where: { slackUserId },
    orderBy: { entryDate: "asc" }
  });

  const counters = emptyCounters();
  for (const entry of entries) {
    accumulateEntry(counters, entry);
  }

  const userId = await resolveUserIdByEmail(counters.userEmail);

  const counts = {
    userId,
    userEmail: counters.userEmail,
    userName: counters.userName,
    wfhCount: counters.wfhCount,
    leaveCount: counters.leaveCount,
    compOffCount: counters.compOffCount,
    officeCount: counters.officeCount,
    onTimeCount: counters.onTimeCount,
    lateSubmissionCount: counters.lateSubmissionCount,
    lateArrivalCount: counters.lateArrivalCount,
    missingCount: counters.missingCount,
    submittedCount: counters.submittedCount,
    lastEntryDate: counters.lastEntryDate,
    lastComputedAt: new Date()
  };

  return prisma.attendancePersonStats.upsert({
    where: { slackUserId },
    create: {
      slackUserId,
      ...counts
    },
    update: counts
  });
}

export async function recomputePersonStatsMany(slackUserIds: string[]): Promise<number> {
  const unique = [...new Set(slackUserIds.filter(Boolean))];
  for (const slackUserId of unique) {
    await recomputePersonStats(slackUserId);
  }
  return unique.length;
}

export type ListPersonStatsFilters = {
  actionStatus?: AttendanceActionStatus;
  minWfh?: number;
  minLeave?: number;
  minLateSubmission?: number;
  minLateArrival?: number;
  minMissing?: number;
  sortBy?:
    | "wfhCount"
    | "leaveCount"
    | "lateSubmissionCount"
    | "lateArrivalCount"
    | "missingCount"
    | "onTimeCount"
    | "userName";
  sortDir?: "asc" | "desc";
};

export async function listPersonStats(filters: ListPersonStatsFilters = {}) {
  const sortBy = filters.sortBy ?? "wfhCount";
  const sortDir = filters.sortDir ?? "desc";

  return prisma.attendancePersonStats.findMany({
    where: {
      ...(filters.actionStatus ? { actionStatus: filters.actionStatus } : {}),
      ...(filters.minWfh != null ? { wfhCount: { gte: filters.minWfh } } : {}),
      ...(filters.minLeave != null ? { leaveCount: { gte: filters.minLeave } } : {}),
      ...(filters.minLateSubmission != null
        ? { lateSubmissionCount: { gte: filters.minLateSubmission } }
        : {}),
      ...(filters.minLateArrival != null
        ? { lateArrivalCount: { gte: filters.minLateArrival } }
        : {}),
      ...(filters.minMissing != null ? { missingCount: { gte: filters.minMissing } } : {})
    },
    include: {
      user: { select: { id: true, name: true, email: true, managerUserId: true } },
      actionTakenBy: { select: { id: true, name: true, email: true } }
    },
    orderBy: { [sortBy]: sortDir }
  });
}

export async function findPersonStatsBySlackUserId(slackUserId: string) {
  return prisma.attendancePersonStats.findUnique({
    where: { slackUserId },
    include: {
      user: { select: { id: true, name: true, email: true, managerUserId: true } },
      actionTakenBy: { select: { id: true, name: true, email: true } }
    }
  });
}

export async function updatePersonStatsAction(input: {
  slackUserId: string;
  actionStatus: AttendanceActionStatus;
  actionNote?: string | null;
  actionTakenById: string;
}) {
  const existing = await prisma.attendancePersonStats.findUnique({
    where: { slackUserId: input.slackUserId }
  });
  if (!existing) return null;

  return prisma.attendancePersonStats.update({
    where: { slackUserId: input.slackUserId },
    data: {
      actionStatus: input.actionStatus,
      actionNote: input.actionNote ?? null,
      actionTakenById: input.actionTakenById,
      actionTakenAt: new Date()
    },
    include: {
      user: { select: { id: true, name: true, email: true, managerUserId: true } },
      actionTakenBy: { select: { id: true, name: true, email: true } }
    }
  });
}

export function serializePersonStats(row: {
  id: string;
  slackUserId: string;
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
  wfhCount: number;
  leaveCount: number;
  compOffCount: number;
  officeCount: number;
  onTimeCount: number;
  lateSubmissionCount: number;
  lateArrivalCount: number;
  missingCount: number;
  submittedCount: number;
  actionStatus: string;
  actionNote: string | null;
  actionTakenById: string | null;
  actionTakenAt: Date | null;
  lastEntryDate: Date | null;
  lastComputedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  user?: { id: string; name: string; email: string; managerUserId: string | null } | null;
  actionTakenBy?: { id: string; name: string; email: string } | null;
}) {
  return {
    id: row.id,
    slackUserId: row.slackUserId,
    userId: row.userId,
    userEmail: row.userEmail,
    userName: row.userName,
    counts: {
      wfh: row.wfhCount,
      leave: row.leaveCount,
      compOff: row.compOffCount,
      office: row.officeCount,
      onTime: row.onTimeCount,
      lateSubmission: row.lateSubmissionCount,
      lateArrival: row.lateArrivalCount,
      missing: row.missingCount,
      submitted: row.submittedCount
    },
    action: {
      status: row.actionStatus,
      note: row.actionNote,
      takenById: row.actionTakenById,
      takenBy: row.actionTakenBy
        ? {
            id: row.actionTakenBy.id,
            name: row.actionTakenBy.name,
            email: row.actionTakenBy.email
          }
        : null,
      takenAt: row.actionTakenAt?.toISOString() ?? null
    },
    linkedUser: row.user
      ? {
          id: row.user.id,
          name: row.user.name,
          email: row.user.email,
          managerUserId: row.user.managerUserId
        }
      : null,
    lastEntryDate: row.lastEntryDate ? formatEntryDate(row.lastEntryDate) : null,
    lastComputedAt: row.lastComputedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}
