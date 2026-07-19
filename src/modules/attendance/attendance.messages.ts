/**
 * Human, empathetic Slack copy for attendance reminders and replies.
 */

export function firstName(fullName: string | null | undefined): string {
  const trimmed = fullName?.trim();
  if (!trimmed) return "there";
  return trimmed.split(/\s+/)[0] ?? "there";
}

export function missingAttendanceReminder(input: {
  employeeName: string | null;
  channelLabel: string;
}): string {
  const name = firstName(input.employeeName);
  return [
    `Hey ${name} 👋`,
    "",
    `Hope your morning's going okay — just a gentle reminder that we don't have your attendance note in #${input.channelLabel} yet.`
  ].join("\n");
}

export function pendingWfhApprovalReminder(input: {
  employeeName: string | null;
}): string {
  const name = firstName(input.employeeName);
  return [
    `Hey ${name} 👋`,
    "",
    "You marked WFH for today. Quick check — have you already got approval from your manager?",
    "",
    "Reply here with:",
    '• "yes" / "approved" — manager already approved',
    '• "no" — not approved yet / please treat as not approved',
    "",
    "Thanks."
  ].join("\n");
}

export function pendingLeaveApprovalReminder(input: {
  employeeName: string | null;
}): string {
  const name = firstName(input.employeeName);
  return [
    `Hey ${name} 👋`,
    "",
    "You posted leave / comp off for today. Quick check — have you already got approval from your manager?",
    "",
    "Reply here with:",
    '• "yes" / "approved" — manager already approved',
    '• "no" — not approved yet / please treat as not approved',
    "",
    "Thanks."
  ].join("\n");
}

export function approvalConfirmedReply(input: {
  slackUserId: string;
  label: "WFH" | "leave";
  date: string;
}): string {
  return `Done — <@${input.slackUserId}>'s ${input.label} is approved for ${input.date}.`;
}

export function approvalDeniedReply(input: {
  slackUserId: string;
  label: "WFH" | "leave";
  date: string;
}): string {
  return `Noted — <@${input.slackUserId}>'s ${input.label} wasn't approved for ${input.date}.`;
}
