import { prisma } from "../../lib/prisma";
import { dateInIST, entryDateFromString, formatEntryDate, todayInIST } from "./attendance.dates";

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
      wfhApprovalState: input.recordType === "wfh" ? "pending" : null,
      leaveApprovalState: input.recordType === "leave" ? "pending" : null
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
          }),
      ...(input.recordType === "leave"
        ? {}
        : {
            leaveApprovalState: null,
            leaveApprovedAt: null,
            leaveApprovedBySlackUserId: null,
            leaveApprovalNote: null
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
          wfhApprovalState: input.recordType === "wfh" ? "pending" : null,
          leaveApprovalState: input.recordType === "leave" ? "pending" : null
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
              }),
          ...(input.recordType === "leave"
            ? {}
            : {
                leaveApprovalState: null,
                leaveApprovedAt: null,
                leaveApprovedBySlackUserId: null,
                leaveApprovalNote: null
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
      recordType: true,
      submittedOnTime: true,
      wfhApprovalState: true,
      leaveApprovalState: true
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

/** Entries that still need a manager/employee nudge for the given date. */
export async function findRemindableEntries(
  dateStr: string,
  options: { missingOnly?: boolean } = {}
) {
  const entryDate = entryDateFromString(dateStr);
  if (options.missingOnly) {
    return prisma.etaEntry.findMany({
      where: { entryDate, status: "missing" }
    });
  }
  return prisma.etaEntry.findMany({
    where: {
      entryDate,
      OR: [
        { status: "missing" },
        { recordType: "wfh", wfhApprovalState: "pending" },
        { recordType: "leave", leaveApprovalState: "pending" }
      ]
    }
  });
}

/** Full history for one Slack user (for admin modal). */
export async function findEntriesForUser(
  slackUserId: string,
  options: { from?: string; to?: string; limit?: number } = {}
) {
  return prisma.etaEntry.findMany({
    where: {
      slackUserId,
      ...(options.from || options.to
        ? {
            entryDate: {
              ...(options.from ? { gte: entryDateFromString(options.from) } : {}),
              ...(options.to ? { lte: entryDateFromString(options.to) } : {})
            }
          }
        : {})
    },
    orderBy: [{ entryDate: "desc" }, { id: "desc" }],
    take: options.limit ?? 365
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

export async function findEntryByReminderChannel(channelId: string, dateStr?: string) {
  return prisma.etaEntry.findFirst({
    where: {
      reminderChannelId: channelId,
      ...(dateStr ? { entryDate: entryDateFromString(dateStr) } : {})
    },
    orderBy: { reminderSentAt: "desc" }
  });
}

export async function findEntryBySlackMessageTs(slackMessageTs: string) {
  return prisma.etaEntry.findFirst({
    where: { slackMessageTs }
  });
}

export async function findRemindableEntryForUser(dateStr: string, slackUserId: string) {
  const entryDate = entryDateFromString(dateStr);
  return prisma.etaEntry.findFirst({
    where: {
      entryDate,
      slackUserId,
      OR: [
        { status: "missing" },
        { recordType: "wfh", wfhApprovalState: "pending" },
        { recordType: "leave", leaveApprovalState: "pending" }
      ]
    }
  });
}

export async function applyLeaveApproval(input: {
  entryId: number;
  state: "approved" | "denied" | "pending";
  approvedBySlackUserId?: string | null;
  note?: string | null;
  /** When approving a missing entry, also mark it submitted as leave. */
  markSubmittedAsLeave?: boolean;
  userEmail?: string | null;
  userName?: string | null;
}) {
  const approvedAt = input.state === "approved" ? new Date() : null;

  return prisma.etaEntry.update({
    where: { id: input.entryId },
    data: {
      leaveApprovalState: input.state,
      leaveApprovedAt: approvedAt,
      leaveApprovedBySlackUserId: input.approvedBySlackUserId ?? null,
      leaveApprovalNote: input.note ?? null,
      ...(input.markSubmittedAsLeave && input.state === "approved"
        ? {
            status: "submitted",
            recordType: "leave",
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

export function isRemindableEntry(entry: {
  status: string;
  recordType: string | null;
  wfhApprovalState?: string | null;
  leaveApprovalState?: string | null;
  reminderSentAt?: string | null;
}): boolean {
  if (entry.reminderSentAt) return false;
  if (entry.status === "missing") return true;
  if (entry.recordType === "wfh" && entry.wfhApprovalState === "pending") return true;
  if (entry.recordType === "leave" && entry.leaveApprovalState === "pending") return true;
  return false;
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
  leaveApprovalState?: string | null;
  leaveApprovedAt?: Date | null;
  leaveApprovedBySlackUserId?: string | null;
  leaveApprovalNote?: string | null;
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
    leaveApprovalState: entry.leaveApprovalState ?? null,
    leaveApprovedAt: entry.leaveApprovedAt?.toISOString() ?? null,
    leaveApprovedBySlackUserId: entry.leaveApprovedBySlackUserId ?? null,
    leaveApprovalNote: entry.leaveApprovalNote ?? null,
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
  leaveApprovalState?: string | null;
}): string {
  if (entry.status === "missing") return "missing";
  if (entry.recordType === "wfh") {
    if (entry.wfhApprovalState === "approved") return "wfh_approved";
    if (entry.wfhApprovalState === "denied") return "wfh_denied";
    if (entry.wfhApprovalState === "pending") return "wfh_pending";
    return "wfh";
  }
  if (entry.recordType === "leave") {
    if (entry.leaveApprovalState === "approved") return "leave_approved";
    if (entry.leaveApprovalState === "denied") return "leave_denied";
    if (entry.leaveApprovalState === "pending") return "leave_pending";
    return "leave";
  }
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
  wfhApprovedCount: number;
  wfhDeniedCount: number;
  wfhPendingCount: number;
  wfhUnapprovedCount: number;
  leaveCount: number;
  leaveApprovedCount: number;
  leaveDeniedCount: number;
  leavePendingCount: number;
  leaveUnapprovedCount: number;
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
    wfhApprovedCount: 0,
    wfhDeniedCount: 0,
    wfhPendingCount: 0,
    wfhUnapprovedCount: 0,
    leaveCount: 0,
    leaveApprovedCount: 0,
    leaveDeniedCount: 0,
    leavePendingCount: 0,
    leaveUnapprovedCount: 0,
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

function isApprovedState(state: string | null | undefined): boolean {
  return state === "approved";
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
    wfhApprovalState?: string | null;
    leaveApprovalState?: string | null;
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

  if (entry.recordType === "wfh") {
    counters.wfhCount += 1;
    if (isApprovedState(entry.wfhApprovalState)) {
      counters.wfhApprovedCount += 1;
    } else {
      counters.wfhUnapprovedCount += 1;
      if (entry.wfhApprovalState === "denied") counters.wfhDeniedCount += 1;
      else counters.wfhPendingCount += 1;
    }
  } else if (entry.recordType === "leave") {
    counters.leaveCount += 1;
    if (isApprovedState(entry.leaveApprovalState)) {
      counters.leaveApprovedCount += 1;
    } else {
      counters.leaveUnapprovedCount += 1;
      if (entry.leaveApprovalState === "denied") counters.leaveDeniedCount += 1;
      else counters.leavePendingCount += 1;
    }
  } else if (entry.recordType === "comp_off") {
    counters.compOffCount += 1;
  } else if (entry.recordType === "office") {
    counters.officeCount += 1;
  }

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

/** Recompute one person's rolling stats from eta_entries (honors countsResetAt). */
export async function recomputePersonStats(slackUserId: string) {
  const existing = await prisma.attendancePersonStats.findUnique({
    where: { slackUserId },
    select: { countsResetAt: true }
  });

  const entries = await prisma.etaEntry.findMany({
    where: {
      slackUserId,
      ...(existing?.countsResetAt
        ? { entryDate: { gte: existing.countsResetAt } }
        : {})
    },
    orderBy: { entryDate: "asc" }
  });

  const counters = emptyCounters();
  for (const entry of entries) {
    accumulateEntry(counters, entry);
  }

  // Keep identity from latest entry even when the window is empty after a reset.
  if (!counters.userEmail || !counters.userName) {
    const latest = await prisma.etaEntry.findFirst({
      where: { slackUserId },
      orderBy: { entryDate: "desc" },
      select: { userEmail: true, userName: true }
    });
    if (latest) {
      counters.userEmail = counters.userEmail ?? latest.userEmail;
      counters.userName = counters.userName ?? latest.userName;
    }
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

/**
 * Zero rolling counters by advancing countsResetAt past today (IST) and recomputing.
 * Historical eta_entries are kept for the user modal.
 */
export async function resetPersonStatsCounts(slackUserId: string) {
  const todayNoon = new Date(`${todayInIST()}T12:00:00+05:30`);
  // Start counting from tomorrow so current totals drop to zero immediately.
  const tomorrow = dateInIST(new Date(todayNoon.getTime() + 24 * 60 * 60 * 1000));
  const resetDate = entryDateFromString(tomorrow);

  await prisma.attendancePersonStats.upsert({
    where: { slackUserId },
    create: {
      slackUserId,
      countsResetAt: resetDate
    },
    update: {
      countsResetAt: resetDate
    }
  });

  return recomputePersonStats(slackUserId);
}

/** In-memory breakdown for modal (does not require new DB columns). */
export function summarizeApprovalBreakdown(
  entries: Array<{
    status: string;
    recordType: string | null;
    submittedOnTime: boolean | null;
    isLateArrival: boolean | null;
    wfhApprovalState: string | null;
    leaveApprovalState: string | null;
  }>
) {
  const counters = emptyCounters();
  for (const entry of entries) {
    accumulateEntry(counters, {
      ...entry,
      entryDate: new Date(),
      userEmail: null,
      userName: null
    });
  }
  return {
    wfh: {
      total: counters.wfhCount,
      approved: counters.wfhApprovedCount,
      denied: counters.wfhDeniedCount,
      pending: counters.wfhPendingCount,
      unapproved: counters.wfhUnapprovedCount
    },
    leave: {
      total: counters.leaveCount,
      approved: counters.leaveApprovedCount,
      denied: counters.leaveDeniedCount,
      pending: counters.leavePendingCount,
      unapproved: counters.leaveUnapprovedCount
    },
    office: counters.officeCount,
    onTime: counters.onTimeCount,
    lateSubmission: counters.lateSubmissionCount,
    lateArrival: counters.lateArrivalCount,
    missing: counters.missingCount,
    submitted: counters.submittedCount,
    compOff: counters.compOffCount
  };
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
  countsResetAt?: Date | null;
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
    countsResetAt: row.countsResetAt ? formatEntryDate(row.countsResetAt) : null,
    lastEntryDate: row.lastEntryDate ? formatEntryDate(row.lastEntryDate) : null,
    lastComputedAt: row.lastComputedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}
