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
    `Hope your morning's going okay — just a gentle reminder that we don't have your attendance note in #${input.channelLabel} yet.`,
    "",
    "Whenever you can, drop a quick update there:",
    "• `eta 12:30` — if you're coming to the office",
    "• `wfh` — if you're working from home",
    "• `leave` / `comp off` — if you're out today",
    "",
    "Ideally before 11:30am IST. Thanks."
  ].join("\n");
}

export function pendingWfhApprovalReminder(input: {
  employeeName: string | null;
  managerTag: string;
}): string {
  const name = firstName(input.employeeName);
  return [
    `Hey ${name} — and ${input.managerTag} 👋`,
    "",
    `${name} marked WFH for today. Could you take a quick look when you have a moment, ${input.managerTag}?`,
    "",
    "A short reply here works:",
    '• "yes, approved" — all good for WFH',
    '• "no" — please come to office / not approved',
    "",
    "Thanks."
  ].join("\n");
}

export function pendingLeaveApprovalReminder(input: {
  employeeName: string | null;
  managerTag: string;
}): string {
  const name = firstName(input.employeeName);
  return [
    `Hey ${name} — and ${input.managerTag} 👋`,
    "",
    `${name} posted leave for today. ${input.managerTag}, would you mind confirming when you get a chance?`,
    "",
    "A short reply here is enough:",
    '• "yes, approved"',
    '• "no" / not approved',
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
