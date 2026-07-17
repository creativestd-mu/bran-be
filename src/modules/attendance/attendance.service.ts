import { env } from "../../config/env";
import { prisma } from "../../lib/prisma";
import { HttpError } from "../../utils/httpError";
import { notifyWfhToManager } from "../notifications/notifications.service";
import { classifyApprovalReply } from "./attendance.approval";
import { ATTENDANCE_ADMIN_ROLES } from "./attendance.constants";
import {
  approvalConfirmedReply,
  approvalDeniedReply,
  missingAttendanceReminder,
  pendingLeaveApprovalReminder,
  pendingWfhApprovalReminder
} from "./attendance.messages";
import {
  classifyFlags,
  dateInIST,
  formatEntryDate,
  isWeekendIST,
  slackTsToDate,
  todayInIST
} from "./attendance.dates";
import { parseAttendanceMessage } from "./attendance.parser";
import type { AttendanceListFilter } from "./attendance.schemas";
import {
  applyLeaveApproval,
  applyWfhApproval,
  bulkUpsertSubmittedEntries,
  cleanupStaleMissingEntries,
  findEntriesForDate,
  findEntriesForUsersInDateRange,
  findEntryByReminderChannel,
  findEntryBySlackMessageTs,
  findMissingEntries,
  findEntriesForUser,
  findRemindableEntries,
  resetPersonStatsCounts,
  setPersonStatsCounts,
  getRollingApprovalBreakdown,
  findRemindableEntryForUser,
  findPersonStatsBySlackUserId,
  findSlackMember,
  findSubmittedUserIdsForDate,
  listActiveSlackMembers,
  listPersonStats,
  markReminderSent,
  recomputePersonStats,
  recomputePersonStatsMany,
  serializeEntry,
  serializePersonStats,
  updatePersonStatsAction,
  upsertMissingEntry,
  upsertSlackMember,
  upsertSubmittedEntry,
  type AttendanceActionStatus,
  type ListPersonStatsFilters,
  type UpsertSubmittedInput
} from "./attendance.repository";
import {
  fetchChannelMessagesForDate,
  getSlackUserInfo,
  listChannelMemberIds,
  lookupSlackUserByEmail,
  postSlackMessage,
  resolveChannelId,
  sendDm,
  type SlackMessage
} from "./attendance.slack";

async function maybeNotifyWfhManager(input: {
  recordType: string;
  userEmail: string | null;
  userName: string | null;
  entryDate: string;
  rawMessage?: string | null;
}): Promise<void> {
  if (input.recordType !== "wfh" || !input.userEmail) return;

  try {
    const result = await notifyWfhToManager({
      employeeEmail: input.userEmail,
      employeeName: input.userName,
      entryDate: input.entryDate,
      rawMessage: input.rawMessage ?? null
    });
    if (!result.notified && result.reason) {
      console.log(
        `[attendance] WFH manager notify skipped for ${input.userEmail}: ${result.reason}`
      );
    }
  } catch (error) {
    console.error(
      `[attendance] WFH manager notify failed for ${input.userEmail}:`,
      error
    );
  }
}

function emailAllowed(email: string | null | undefined): boolean {
  if (!email) return false;
  const domain = env.attendanceEmailDomain.toLowerCase().replace(/^@/, "");
  return email.toLowerCase().endsWith(`@${domain}`);
}

function displayName(user: {
  name?: string;
  real_name?: string;
  profile?: { real_name?: string; display_name?: string };
}): string {
  return (
    user.profile?.real_name ||
    user.real_name ||
    user.profile?.display_name ||
    user.name ||
    "Unknown"
  );
}

export function canManageAttendance(roleName: string): boolean {
  return ATTENDANCE_ADMIN_ROLES.has(roleName);
}

export function assertCanManageAttendance(roleName: string): void {
  if (!canManageAttendance(roleName)) {
    throw new HttpError(403, "Only admin or chief of staff can access attendance");
  }
}

export async function submitAttendanceFromSlack(input: {
  slackUserId: string;
  userEmail: string | null;
  userName: string | null;
  text: string;
  messageTs: string;
  recordType: string;
  etaText: string | null;
  etaMinutes: number | null;
}): Promise<ReturnType<typeof serializeEntry>> {
  const submittedAt = slackTsToDate(input.messageTs);
  const entryDate = dateInIST(submittedAt);

  const member = await findSlackMember(input.slackUserId);
  const skipSubmissionDeadline = member?.pod === "production";

  const flags = classifyFlags({
    submittedAt,
    etaMinutes: input.etaMinutes,
    recordType: input.recordType,
    skipSubmissionDeadline
  });

  const entry = await upsertSubmittedEntry({
    slackUserId: input.slackUserId,
    userEmail: input.userEmail,
    userName: input.userName,
    entryDate,
    etaText: input.etaText,
    etaMinutes: input.etaMinutes,
    recordType: input.recordType,
    submittedAt,
    submittedOnTime: flags.submittedOnTime,
    isLateArrival: flags.isLateArrival,
    rawMessage: input.text,
    slackMessageTs: input.messageTs
  });

  await cleanupStaleMissingEntries(entryDate);
  await recomputePersonStats(input.slackUserId);

  await maybeNotifyWfhManager({
    recordType: input.recordType,
    userEmail: input.userEmail,
    userName: input.userName,
    entryDate,
    rawMessage: input.text
  });

  return serializeEntry(entry);
}

function isIngestibleMessage(message: SlackMessage): boolean {
  if (!message.user || !message.text || !message.ts) return false;
  if (message.bot_id) return false;
  if (message.subtype) return false;
  // Thread replies (not the parent) are ignored for attendance *submission*
  if (message.thread_ts && message.thread_ts !== message.ts) return false;
  return true;
}

async function resolveManagerSlackContext(employeeEmail: string | null): Promise<{
  managerName: string | null;
  managerSlackUserId: string | null;
} | null> {
  if (!employeeEmail?.trim()) return null;

  const employee = await prisma.user.findFirst({
    where: {
      isActive: true,
      email: { equals: employeeEmail.trim().toLowerCase(), mode: "insensitive" }
    },
    select: {
      manager: {
        select: { name: true, email: true, isActive: true }
      }
    }
  });

  const manager = employee?.manager;
  if (!manager?.isActive || !manager.email) {
    return manager?.name ? { managerName: manager.name, managerSlackUserId: null } : null;
  }

  const slackManager = await lookupSlackUserByEmail(manager.email);
  return {
    managerName: manager.name,
    managerSlackUserId: slackManager?.id ?? null
  };
}

export async function sendReminder(
  slackUserId: string,
  entry: {
    status: string;
    recordType: string | null;
    wfhApprovalState?: string | null;
    leaveApprovalState?: string | null;
  }
): Promise<{ channel: string; ts: string }> {
  const channelLabel = env.slackChannelName.replace(/^#/, "");
  const member = await findSlackMember(slackUserId);
  const slackUser = member ? null : await getSlackUserInfo(slackUserId);
  const employeeName = member?.realName ?? member?.name ?? slackUser?.profile?.real_name ?? null;

  const reminderKind =
    entry.status === "missing"
      ? "missing"
      : entry.recordType === "wfh" && entry.wfhApprovalState === "pending"
        ? "wfh_pending"
        : entry.recordType === "leave" && entry.leaveApprovalState === "pending"
          ? "leave_pending"
          : "missing";

  const text =
    reminderKind === "wfh_pending"
      ? pendingWfhApprovalReminder({ employeeName })
      : reminderKind === "leave_pending"
        ? pendingLeaveApprovalReminder({ employeeName })
        : missingAttendanceReminder({ employeeName, channelLabel });

  // Always 1:1 DM the employee — no daily manager/employee group chats.
  return sendDm(slackUserId, text);
}

export async function sendRemindersForDate(
  dateStr: string,
  options: { missingOnly?: boolean } = {}
): Promise<{
  sent: number;
  skipped: number;
  errors: string[];
}> {
  const remindable = await findRemindableEntries(dateStr, {
    missingOnly: options.missingOnly
  });
  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const entry of remindable) {
    if (!entry.slackUserId) {
      skipped += 1;
      continue;
    }
    if (entry.reminderSentAt) {
      skipped += 1;
      continue;
    }

    const member = await findSlackMember(entry.slackUserId);
    if (member?.pod === "production") {
      skipped += 1;
      continue;
    }

    try {
      const posted = await sendReminder(entry.slackUserId, entry);
      await markReminderSent(entry.id, { channelId: posted.channel, slackTs: posted.ts });
      sent += 1;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(`${entry.slackUserId}: ${msg}`);
    }
  }

  return { sent, skipped, errors };
}

export async function sendReminderForUser(
  dateStr: string,
  slackUserId: string
): Promise<{ sent: number; skipped: number; errors: string[] }> {
  const entry = await findRemindableEntryForUser(dateStr, slackUserId);
  if (!entry) {
    throw new HttpError(
      404,
      "No remindable attendance entry for this user on that date (missing ETA, pending WFH, or pending leave)"
    );
  }

  if (entry.reminderSentAt) {
    return { sent: 0, skipped: 1, errors: [] };
  }

  const member = await findSlackMember(slackUserId);
  if (member?.pod === "production") {
    return { sent: 0, skipped: 1, errors: [] };
  }

  try {
    const posted = await sendReminder(slackUserId, entry);
    await markReminderSent(entry.id, { channelId: posted.channel, slackTs: posted.ts });
    return { sent: 1, skipped: 0, errors: [] };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { sent: 0, skipped: 0, errors: [`${slackUserId}: ${msg}`] };
  }
}

/**
 * Process a Slack reply (DM/MPIM reminder thread or channel thread on a WFH post).
 * Clear yes/no phrases are resolved directly; ambiguous replies use the AI layer.
 */
export async function processWfhApprovalReply(input: {
  channelId: string;
  userId: string;
  text: string;
  ts: string;
  threadTs?: string;
  channelType?: string;
}): Promise<{ handled: boolean; reason?: string; decision?: string }> {
  if (!input.text.trim()) {
    return { handled: false, reason: "empty_text" };
  }

  let entry =
    (input.threadTs ? await findEntryBySlackMessageTs(input.threadTs) : null) ??
    (await findEntryByReminderChannel(input.channelId, todayInIST())) ??
    (await findEntryByReminderChannel(input.channelId));

  // Reminder thread reply: parent is the reminder message ts
  if (!entry && input.threadTs) {
    entry = await prisma.etaEntry.findFirst({
      where: { reminderSlackTs: input.threadTs }
    });
  }

  if (!entry?.slackUserId) {
    return { handled: false, reason: "no_matching_entry" };
  }

  const approvalKind =
    entry.recordType === "leave"
      ? "leave"
      : entry.recordType === "wfh" || entry.wfhApprovalState
        ? "wfh"
        : null;

  if (!approvalKind) {
    return { handled: false, reason: "not_approval_entry" };
  }

  const currentApprovalState =
    approvalKind === "leave" ? entry.leaveApprovalState : entry.wfhApprovalState;

  // Don't re-process already decided approvals
  if (currentApprovalState === "approved" || currentApprovalState === "denied") {
    return { handled: false, reason: "already_decided" };
  }

  const employeeEmail = entry.userEmail;
  const manager = await resolveManagerSlackContext(employeeEmail);
  const isManager = Boolean(
    manager?.managerSlackUserId && manager.managerSlackUserId === input.userId
  );
  const isEmployee = entry.slackUserId === input.userId;

  // Anyone already in the reminder conversation can confirm; prefer manager match.
  // (Slack events for MPIMs sometimes omit useful membership checks.)
  if (!isManager && !isEmployee && entry.reminderChannelId !== input.channelId) {
    return { handled: false, reason: "not_manager_or_employee" };
  }

  let classification: Awaited<ReturnType<typeof classifyApprovalReply>>;
  try {
    classification = await classifyApprovalReply({
      requestType: approvalKind,
      replyText: input.text,
      employeeName: entry.userName,
      entryDate: formatEntryDate(entry.entryDate),
      originalMessage: entry.rawMessage
    });
  } catch (error) {
    console.error("[attendance] approval AI failed:", error);
    return { handled: false, reason: "ai_failed" };
  }

  if (classification.decision === "unclear") {
    console.log("[attendance] approval unclear", {
      entryId: entry.id,
      approvalKind,
      userId: input.userId,
      text: input.text.slice(0, 120)
    });
    return { handled: true, reason: "unclear", decision: "unclear" };
  }

  const markSubmittedAsWfh =
    approvalKind === "wfh" &&
    classification.decision === "approved" &&
    (entry.status === "missing" || entry.recordType !== "wfh");

  const markSubmittedAsLeave =
    approvalKind === "leave" &&
    classification.decision === "approved" &&
    (entry.status === "missing" || entry.recordType !== "leave");

  const updated =
    approvalKind === "leave"
      ? await applyLeaveApproval({
          entryId: entry.id,
          state: classification.decision,
          approvedBySlackUserId: isManager ? input.userId : manager?.managerSlackUserId ?? input.userId,
          note: classification.reason ?? input.text,
          markSubmittedAsLeave,
          userEmail: entry.userEmail,
          userName: entry.userName
        })
      : await applyWfhApproval({
          entryId: entry.id,
          state: classification.decision,
          approvedBySlackUserId: isManager ? input.userId : manager?.managerSlackUserId ?? input.userId,
          note: classification.reason ?? input.text,
          markSubmittedAsWfh,
          userEmail: entry.userEmail,
          userName: entry.userName
        });

  if (markSubmittedAsWfh || markSubmittedAsLeave) {
    await cleanupStaleMissingEntries(formatEntryDate(entry.entryDate));
  }
  if (entry.slackUserId) {
    await recomputePersonStats(entry.slackUserId);
  }

  if (classification.decision === "approved" && updated.recordType === "wfh") {
    await maybeNotifyWfhManager({
      recordType: "wfh",
      userEmail: updated.userEmail,
      userName: updated.userName,
      entryDate: formatEntryDate(updated.entryDate),
      rawMessage: updated.rawMessage
    });
  }

  try {
    const isThreadReply = Boolean(input.threadTs && input.threadTs !== input.ts);
    const label = approvalKind === "leave" ? "leave" : "WFH";
    const reply =
      classification.decision === "approved"
        ? approvalConfirmedReply({
            slackUserId: entry.slackUserId!,
            label,
            date: formatEntryDate(entry.entryDate)
          })
        : approvalDeniedReply({
            slackUserId: entry.slackUserId!,
            label,
            date: formatEntryDate(entry.entryDate)
          });
    await postSlackMessage(
      input.channelId,
      reply,
      isThreadReply ? { threadTs: input.threadTs } : undefined
    );
  } catch (error) {
    console.error("[attendance] Failed to post approval confirmation:", error);
  }

  return { handled: true, decision: classification.decision };
}

export async function processSlackChannelMessage(input: {
  channelId: string;
  userId: string;
  text: string;
  ts: string;
  botId?: string;
  subtype?: string;
  threadTs?: string;
  channelType?: string;
}): Promise<{ recorded: boolean; reason?: string }> {
  if (input.botId || input.subtype) {
    return { recorded: false, reason: "ignored_bot_or_subtype" };
  }

  const isThreadReply = Boolean(input.threadTs && input.threadTs !== input.ts);
  const isImOrMpim =
    input.channelType === "im" ||
    input.channelType === "mpim" ||
    input.channelId.startsWith("D");
  const reminderEntry = await findEntryByReminderChannel(input.channelId, todayInIST());
  const isReminderChannel = Boolean(reminderEntry);

  // Manager/employee approval replies — DM/MPIM, reminder conversation, or channel thread
  if (isThreadReply || isImOrMpim || isReminderChannel) {
    console.log("[attendance] Trying WFH approval reply", {
      channelId: input.channelId,
      channelType: input.channelType,
      userId: input.userId,
      isThreadReply,
      isImOrMpim,
      isReminderChannel,
      textPreview: input.text.slice(0, 80)
    });
    const approval = await processWfhApprovalReply({
      channelId: input.channelId,
      userId: input.userId,
      text: input.text,
      ts: input.ts,
      threadTs: input.threadTs,
      channelType: input.channelType
    });
    if (approval.handled) {
      return { recorded: false, reason: `wfh_approval_${approval.decision ?? approval.reason}` };
    }
    // Don't treat DM/MPIM or reminder-channel replies as attendance submissions
    if (isImOrMpim || isReminderChannel || isThreadReply) {
      return { recorded: false, reason: approval.reason ?? "ignored_non_attendance_reply" };
    }
  }

  const targetChannelId = await resolveChannelId();
  if (input.channelId !== targetChannelId) {
    return { recorded: false, reason: "wrong_channel" };
  }

  const parsed = parseAttendanceMessage(input.text);
  if (!parsed) {
    return { recorded: false, reason: "unrecognized_message" };
  }

  const user = await getSlackUserInfo(input.userId);
  if (user.is_bot || user.deleted) {
    return { recorded: false, reason: "ignored_bot_or_deleted_user" };
  }

  const email = user.profile?.email ?? null;
  if (!emailAllowed(email)) {
    return { recorded: false, reason: "email_domain_rejected" };
  }

  await upsertSlackMember({
    slackUserId: user.id,
    name: user.name ?? null,
    email,
    realName: displayName(user),
    isBot: Boolean(user.is_bot),
    isDeleted: Boolean(user.deleted)
  });

  await submitAttendanceFromSlack({
    slackUserId: user.id,
    userEmail: email,
    userName: displayName(user),
    text: input.text,
    messageTs: input.ts,
    recordType: parsed.recordType,
    etaText: parsed.etaText,
    etaMinutes: parsed.etaMinutes
  });

  return { recorded: true };
}

export async function syncSlackMembers(): Promise<{ synced: number }> {
  const memberIds = await listChannelMemberIds();
  let synced = 0;

  for (const userId of memberIds) {
    try {
      const user = await getSlackUserInfo(userId);
      await upsertSlackMember({
        slackUserId: user.id,
        name: user.name ?? null,
        email: user.profile?.email ?? null,
        realName: displayName(user),
        isBot: Boolean(user.is_bot),
        isDeleted: Boolean(user.deleted)
      });
      synced += 1;
    } catch (error) {
      console.error(`Failed to sync Slack member ${userId}:`, error);
    }
  }

  return { synced };
}

export async function syncAttendanceFromSlackHistory(dateStr: string): Promise<{
  processed: number;
  recorded: number;
  errors: string[];
}> {
  const messages = await fetchChannelMessagesForDate(dateStr);
  const errors: string[] = [];
  const byUser = new Map<string, UpsertSubmittedInput>();

  // Process oldest → newest so the latest message for a user wins
  const ordered = [...messages].sort((a, b) => Number(a.ts) - Number(b.ts));

  for (const message of ordered) {
    if (!isIngestibleMessage(message)) continue;

    const parsed = parseAttendanceMessage(message.text!);
    if (!parsed) continue;

    try {
      const user = await getSlackUserInfo(message.user!);
      if (user.is_bot || user.deleted) continue;

      const email = user.profile?.email ?? null;
      if (!emailAllowed(email)) continue;

      await upsertSlackMember({
        slackUserId: user.id,
        name: user.name ?? null,
        email,
        realName: displayName(user),
        isBot: Boolean(user.is_bot),
        isDeleted: Boolean(user.deleted)
      });

      const submittedAt = slackTsToDate(message.ts);
      const member = await findSlackMember(user.id);
      const flags = classifyFlags({
        submittedAt,
        etaMinutes: parsed.etaMinutes,
        recordType: parsed.recordType,
        skipSubmissionDeadline: member?.pod === "production"
      });

      byUser.set(user.id, {
        slackUserId: user.id,
        userEmail: email,
        userName: displayName(user),
        entryDate: dateStr,
        etaText: parsed.etaText,
        etaMinutes: parsed.etaMinutes,
        recordType: parsed.recordType,
        submittedAt,
        submittedOnTime: flags.submittedOnTime,
        isLateArrival: flags.isLateArrival,
        rawMessage: message.text!,
        slackMessageTs: message.ts
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(`ts=${message.ts}: ${msg}`);
    }
  }

  const entries = [...byUser.values()];
  const recorded = await bulkUpsertSubmittedEntries(entries);
  await cleanupStaleMissingEntries(dateStr);
  await recomputePersonStatsMany(entries.map((e) => e.slackUserId));

  for (const entry of entries) {
    await maybeNotifyWfhManager({
      recordType: entry.recordType,
      userEmail: entry.userEmail,
      userName: entry.userName,
      entryDate: entry.entryDate,
      rawMessage: entry.rawMessage
    });
  }

  return {
    processed: messages.length,
    recorded,
    errors
  };
}

export async function runEtaCheck(
  dateStr: string = todayInIST(),
  options: { sendReminders?: boolean; missingOnlyReminders?: boolean } = {}
): Promise<{
  date: string;
  weekend: boolean;
  membersSynced: number;
  history: { processed: number; recorded: number; errors: string[] };
  missingCreated: number;
  reminders?: { sent: number; skipped: number; errors: string[] };
}> {
  if (isWeekendIST(dateStr)) {
    return {
      date: dateStr,
      weekend: true,
      membersSynced: 0,
      history: { processed: 0, recorded: 0, errors: [] },
      missingCreated: 0
    };
  }

  const { synced: membersSynced } = await syncSlackMembers();
  const history = await syncAttendanceFromSlackHistory(dateStr);
  await cleanupStaleMissingEntries(dateStr);

  const submittedIds = await findSubmittedUserIdsForDate(dateStr);
  const members = await listActiveSlackMembers();

  for (const member of members) {
    if (member.isBot || member.isDeleted) continue;
    if (member.pod === "production") continue;
    if (!emailAllowed(member.email)) continue;
    if (submittedIds.has(member.slackUserId)) continue;

    await upsertMissingEntry({
      slackUserId: member.slackUserId,
      userEmail: member.email,
      userName: member.realName ?? member.name,
      entryDate: dateStr
    });
  }

  const missingAfter = await findMissingEntries(dateStr);
  const missingCreated = missingAfter.length;

  const statsUserIds = [
    ...new Set([
      ...members.map((m) => m.slackUserId),
      ...missingAfter.map((m) => m.slackUserId).filter((id): id is string => Boolean(id))
    ])
  ];
  await recomputePersonStatsMany(statsUserIds);

  let reminders: { sent: number; skipped: number; errors: string[] } | undefined;
  if (options.sendReminders) {
    reminders = await sendRemindersForDate(dateStr, {
      missingOnly: options.missingOnlyReminders
    });
  }

  return {
    date: dateStr,
    weekend: false,
    membersSynced,
    history,
    missingCreated,
    reminders
  };
}

export type AttendanceMonthCounts = {
  leave: number;
  leaveApproved: number;
  leaveDenied: number;
  leavePending: number;
  leaveUnapproved: number;
  wfh: number;
  wfhApproved: number;
  wfhDenied: number;
  wfhPending: number;
  wfhUnapproved: number;
  office: number;
  onTime: number;
  lateSubmission: number;
  missing: number;
};

function emptyMonthCounts(): AttendanceMonthCounts {
  return {
    leave: 0,
    leaveApproved: 0,
    leaveDenied: 0,
    leavePending: 0,
    leaveUnapproved: 0,
    wfh: 0,
    wfhApproved: 0,
    wfhDenied: 0,
    wfhPending: 0,
    wfhUnapproved: 0,
    office: 0,
    onTime: 0,
    lateSubmission: 0,
    missing: 0
  };
}

/** Inclusive calendar-month bounds (IST YYYY-MM-DD) for the month containing dateStr. */
export function monthBoundsForDate(dateStr: string): { start: string; end: string } {
  const [year, month] = dateStr.split("-").map(Number);
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const end = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

async function buildMonthCountsBySlackUserId(
  slackUserIds: string[],
  dateStr: string
): Promise<Map<string, AttendanceMonthCounts>> {
  const counts = new Map<string, AttendanceMonthCounts>();
  const uniqueIds = [...new Set(slackUserIds.filter(Boolean))];
  if (uniqueIds.length === 0) return counts;

  const { start, end } = monthBoundsForDate(dateStr);
  const history = await findEntriesForUsersInDateRange(uniqueIds, start, end);

  for (const slackUserId of uniqueIds) {
    counts.set(slackUserId, emptyMonthCounts());
  }

  for (const row of history) {
    if (!row.slackUserId) continue;
    const current = counts.get(row.slackUserId) ?? emptyMonthCounts();
    if (row.status === "missing") {
      current.missing += 1;
    } else if (row.recordType === "leave") {
      current.leave += 1;
      if (row.leaveApprovalState === "approved") current.leaveApproved += 1;
      else {
        current.leaveUnapproved += 1;
        if (row.leaveApprovalState === "denied") current.leaveDenied += 1;
        else current.leavePending += 1;
      }
    } else if (row.recordType === "wfh") {
      current.wfh += 1;
      if (row.wfhApprovalState === "approved") current.wfhApproved += 1;
      else {
        current.wfhUnapproved += 1;
        if (row.wfhApprovalState === "denied") current.wfhDenied += 1;
        else current.wfhPending += 1;
      }
    } else if (row.recordType === "office") {
      current.office += 1;
      if (row.submittedOnTime === true) current.onTime += 1;
      if (row.submittedOnTime === false) current.lateSubmission += 1;
    }
    counts.set(row.slackUserId, current);
  }

  return counts;
}

function entryMatchesListFilter(
  entry: { status: string; recordType: string | null },
  filter: AttendanceListFilter
): boolean {
  switch (filter) {
    case "total":
      return true;
    case "submitted":
      return entry.status === "submitted";
    case "missing":
      return entry.status === "missing";
    case "office":
      return entry.recordType === "office";
    case "wfh":
      return entry.recordType === "wfh";
    case "leave":
      return entry.recordType === "leave";
    case "compOff":
      return entry.recordType === "comp_off";
    default:
      return true;
  }
}

export async function listTodayAttendance(
  dateStr: string = todayInIST(),
  filter: AttendanceListFilter = "total"
) {
  const entries = await findEntriesForDate(dateStr);
  const filteredEntries =
    filter === "total" ? entries : entries.filter((entry) => entryMatchesListFilter(entry, filter));

  const monthCounts = await buildMonthCountsBySlackUserId(
    filteredEntries.map((e) => e.slackUserId).filter((id): id is string => Boolean(id)),
    dateStr
  );

  return {
    date: dateStr,
    entries: filteredEntries.map((entry) => ({
      ...serializeEntry(entry),
      monthCounts: entry.slackUserId
        ? monthCounts.get(entry.slackUserId) ?? emptyMonthCounts()
        : emptyMonthCounts()
    })),
    summary: {
      total: entries.length,
      submitted: entries.filter((e) => e.status === "submitted").length,
      missing: entries.filter((e) => e.status === "missing").length,
      wfh: entries.filter((e) => e.recordType === "wfh").length,
      leave: entries.filter((e) => e.recordType === "leave").length,
      compOff: entries.filter((e) => e.recordType === "comp_off").length,
      office: entries.filter((e) => e.recordType === "office").length
    }
  };
}

export async function updateMemberPod(slackUserId: string, pod: "default" | "production") {
  const member = await findSlackMember(slackUserId);
  if (!member) {
    throw new HttpError(404, "Slack member not found. Run a check first to sync members.");
  }

  return prisma.slackMember.update({
    where: { slackUserId },
    data: { pod }
  });
}

export async function listAttendancePersonStats(filters: ListPersonStatsFilters = {}) {
  const rows = await listPersonStats(filters);
  return rows.map(serializePersonStats);
}

export async function getAttendancePersonStats(slackUserId: string) {
  let row = await findPersonStatsBySlackUserId(slackUserId);
  if (!row) {
    // Recompute on demand if entries exist but stats row was never created.
    await recomputePersonStats(slackUserId);
    row = await findPersonStatsBySlackUserId(slackUserId);
  }
  if (!row) {
    throw new HttpError(404, "Attendance stats not found for this Slack user");
  }
  return serializePersonStats(row);
}

/**
 * Detail payload for the admin user modal: stats + full history of
 * WFH / leave / ETA with approved vs unapproved states.
 */
export async function getAttendanceUserDetail(
  slackUserId: string,
  options: { from?: string; to?: string; limit?: number } = {}
) {
  const stats = await getAttendancePersonStats(slackUserId);
  const entries = await findEntriesForUser(slackUserId, options);
  const serialized = entries.map(serializeEntry);
  // Chips use rolling counters (baselines + entries since reset); lists keep full history.
  const breakdown = await getRollingApprovalBreakdown(slackUserId);

  return {
    stats,
    breakdown,
    entries: serialized,
    groups: {
      wfh: {
        approved: serialized.filter(
          (e) => e.recordType === "wfh" && e.wfhApprovalState === "approved"
        ),
        denied: serialized.filter(
          (e) => e.recordType === "wfh" && e.wfhApprovalState === "denied"
        ),
        pending: serialized.filter(
          (e) => e.recordType === "wfh" && e.wfhApprovalState === "pending"
        ),
        unapproved: serialized.filter(
          (e) => e.recordType === "wfh" && e.wfhApprovalState !== "approved"
        )
      },
      leave: {
        approved: serialized.filter(
          (e) => e.recordType === "leave" && e.leaveApprovalState === "approved"
        ),
        denied: serialized.filter(
          (e) => e.recordType === "leave" && e.leaveApprovalState === "denied"
        ),
        pending: serialized.filter(
          (e) => e.recordType === "leave" && e.leaveApprovalState === "pending"
        ),
        unapproved: serialized.filter(
          (e) => e.recordType === "leave" && e.leaveApprovalState !== "approved"
        )
      },
      eta: serialized.filter((e) => e.recordType === "office"),
      missing: serialized.filter((e) => e.status === "missing"),
      other: serialized.filter(
        (e) =>
          e.status !== "missing" &&
          e.recordType !== "wfh" &&
          e.recordType !== "leave" &&
          e.recordType !== "office"
      )
    }
  };
}

async function ensurePersonStatsRow(slackUserId: string) {
  const existing = await findPersonStatsBySlackUserId(slackUserId);
  if (existing) return existing;
  const hasEntries = await prisma.etaEntry.count({ where: { slackUserId } });
  if (hasEntries === 0) {
    throw new HttpError(404, "Attendance stats not found for this Slack user");
  }
  await recomputePersonStats(slackUserId);
  return findPersonStatsBySlackUserId(slackUserId);
}

export async function resetAttendancePersonCounts(slackUserId: string) {
  await ensurePersonStatsRow(slackUserId);
  const row = await resetPersonStatsCounts(slackUserId);
  const withRelations = await findPersonStatsBySlackUserId(slackUserId);
  return serializePersonStats(withRelations ?? row);
}

export async function setAttendancePersonCounts(
  slackUserId: string,
  input: {
    wfhApproved: number;
    wfhDenied: number;
    wfhPending: number;
    leaveApproved: number;
    leaveDenied: number;
    leavePending: number;
    missing: number;
    onTime: number;
    lateSubmission: number;
    lateArrival: number;
  }
) {
  await ensurePersonStatsRow(slackUserId);
  const row = await setPersonStatsCounts(slackUserId, input);
  const withRelations = await findPersonStatsBySlackUserId(slackUserId);
  return serializePersonStats(withRelations ?? row);
}

export async function setAttendancePersonAction(input: {
  slackUserId: string;
  actionStatus: AttendanceActionStatus;
  actionNote?: string | null;
  actionTakenById: string;
}) {
  let updated = await updatePersonStatsAction(input);
  if (!updated) {
    await recomputePersonStats(input.slackUserId);
    updated = await updatePersonStatsAction(input);
  }
  if (!updated) {
    throw new HttpError(404, "Attendance stats not found for this Slack user");
  }
  return serializePersonStats(updated);
}

/** Rebuild stats for every slack user that has eta_entries. */
export async function rebuildAllAttendancePersonStats(): Promise<{ rebuilt: number }> {
  const rows = await prisma.etaEntry.findMany({
    where: { slackUserId: { not: null } },
    select: { slackUserId: true },
    distinct: ["slackUserId"]
  });
  const ids = rows
    .map((r) => r.slackUserId)
    .filter((id): id is string => Boolean(id));
  const rebuilt = await recomputePersonStatsMany(ids);
  return { rebuilt };
}
