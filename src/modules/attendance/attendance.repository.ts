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
      slackMessageTs: input.slackMessageTs
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
      slackMessageTs: input.slackMessageTs
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
          slackMessageTs: input.slackMessageTs
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
          slackMessageTs: input.slackMessageTs
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

export async function markReminderSent(id: number) {
  return prisma.etaEntry.update({
    where: { id },
    data: { reminderSentAt: new Date() }
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
}): string {
  if (entry.status === "missing") return "missing";
  if (entry.recordType === "wfh") return "wfh";
  if (entry.recordType === "leave") return "leave";
  if (entry.recordType === "comp_off") return "comp_off";
  if (entry.isLateArrival) return "late_arrival";
  if (entry.submittedOnTime === false) return "late_submission";
  if (entry.submittedOnTime === true) return "on_time";
  return "submitted";
}
