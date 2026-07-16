import { env } from "../../config/env";
import { sendEmail } from "../../lib/email";
import { prisma } from "../../lib/prisma";
import { HttpError } from "../../utils/httpError";
import {
  createNotification,
  CreateNotificationInput,
  countUnread,
  getNotificationByIdForUser,
  listNotifications,
  ListNotificationsFilters,
  markAllNotificationsRead,
  markEmailSent,
  markNotificationRead
} from "./notifications.repository";

type ApprovedOutput = {
  id: string;
  label: string;
  url: string;
  notes: string | null;
  version: number;
  reviewedAt: Date | null;
  approvalState: string;
  reviewedBy?: { id: string; name: string; email: string } | null;
  submittedBy?: { id: string; name: string; email: string } | null;
};

type NodeRef = {
  id: string;
  name: string;
  kind: string;
  orderIndex: number;
};

type ContentRef = {
  id: string;
  title: string;
  ownerId: string | null;
};

export type NotifyNextStepInput = {
  content: ContentRef;
  fromNode: NodeRef;
  toNode: NodeRef;
  approvedOutput: ApprovedOutput;
  recipientUserIds: string[];
};

function buildContentLink(contentId: string, nodeId?: string): string {
  if (!env.appUrl) return "";
  const base = env.appUrl.replace(/\/$/, "");
  return nodeId
    ? `${base}/contents/${contentId}?nodeId=${nodeId}`
    : `${base}/contents/${contentId}`;
}

function buildIdeationLink(ideaId: string): string {
  if (!env.appUrl) return "";
  const base = env.appUrl.replace(/\/$/, "");
  return `${base}/ideation/ideas/${ideaId}`;
}

function buildWorkUnitLink(workUnitId: string): string {
  if (!env.appUrl) return "";
  return `${env.appUrl.replace(/\/$/, "")}/work/${workUnitId}`;
}

function buildAttendanceLink(date?: string): string {
  if (!env.appUrl) return "";
  const base = `${env.appUrl.replace(/\/$/, "")}/attendance`;
  return date ? `${base}?date=${encodeURIComponent(date)}` : base;
}

function buildNotificationCopy(input: NotifyNextStepInput) {
  const { content, fromNode, toNode, approvedOutput } = input;
  const title = `${fromNode.name} approved — ${toNode.name} is ready to start`;
  const link = buildContentLink(content.id, toNode.id);

  const inAppBody =
    `"${fromNode.name}" approved on "${content.title}". ` +
    `Your next step "${toNode.name}" is ready.`;

  const lines = [
    `"${fromNode.name}" (${fromNode.kind}) on "${content.title}" was just completed and approved.`,
    `You're assigned to the next step: "${toNode.name}" (${toNode.kind}).`,
    "",
    "Approved output from the previous step:",
    `  • Label   : ${approvedOutput.label}`,
    `  • URL     : ${approvedOutput.url}`,
    `  • Version : v${approvedOutput.version}`
  ];
  if (approvedOutput.notes) {
    lines.push(`  • Notes   : ${approvedOutput.notes}`);
  }
  if (link) {
    lines.push("", `Open in app: ${link}`);
  }

  const emailBody = lines.join("\n");

  const html = `
    <p>"<strong>${escapeHtml(fromNode.name)}</strong>" (${escapeHtml(
      fromNode.kind
    )}) on "<strong>${escapeHtml(
      content.title
    )}</strong>" was just completed and approved.</p>
    <p>You're assigned to the next step: "<strong>${escapeHtml(
      toNode.name
    )}</strong>" (${escapeHtml(toNode.kind)}).</p>
    <h4 style="margin-bottom:4px">Approved output from the previous step</h4>
    <ul>
      <li><strong>Label:</strong> ${escapeHtml(approvedOutput.label)}</li>
      <li><strong>URL:</strong> <a href="${escapeAttr(
        approvedOutput.url
      )}">${escapeHtml(approvedOutput.url)}</a></li>
      <li><strong>Version:</strong> v${approvedOutput.version}</li>
      ${
        approvedOutput.notes
          ? `<li><strong>Notes:</strong> ${escapeHtml(approvedOutput.notes)}</li>`
          : ""
      }
    </ul>
    ${link ? `<p><a href="${escapeAttr(link)}">Open in Bran</a></p>` : ""}
  `.trim();

  return { title, inAppBody, emailBody, html };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(value: string): string {
  return escapeHtml(value);
}

/**
 * Create one in-app Notification per recipient and best-effort email each.
 * Idempotent per (recipient, fromNodeId): re-running won't produce duplicates.
 *
 * Recipients without an email simply skip the email step.
 */
export async function notifyNextStepReady(input: NotifyNextStepInput): Promise<{
  recipients: number;
  emailed: number;
}> {
  const recipientIds = Array.from(new Set(input.recipientUserIds)).filter(Boolean);
  if (recipientIds.length === 0) return { recipients: 0, emailed: 0 };

  const users = await prisma.user.findMany({
    where: { id: { in: recipientIds }, isActive: true },
    select: { id: true, email: true, name: true }
  });

  if (users.length === 0) return { recipients: 0, emailed: 0 };

  const { title, inAppBody, emailBody, html } = buildNotificationCopy(input);
  const dedupeKey = `content_node_ready:${input.fromNode.id}:${input.approvedOutput.id}`;
  const payload = {
    contentId: input.content.id,
    contentTitle: input.content.title,
    fromNode: input.fromNode,
    toNode: input.toNode,
    approvedOutput: input.approvedOutput,
    link: buildContentLink(input.content.id, input.toNode.id) || undefined
  };

  let emailed = 0;

  for (const user of users) {
    const notification = await createNotification({
      userId: user.id,
      kind: "CONTENT_NODE_READY",
      title,
      body: inAppBody,
      data: payload,
      dedupeKey
    });

    // Only attempt email when we haven't already sent one for this row.
    // This way a re-trigger after a transient SMTP failure will retry,
    // but a successful send will never double-deliver.
    if (notification.emailSentAt) continue;
    if (!user.email) continue;
    const sent = await sendEmail({
      to: user.email,
      subject: title,
      text: emailBody,
      html
    });
    if (sent) {
      emailed += 1;
      await markEmailSent(notification.id);
    }
  }

  return { recipients: users.length, emailed };
}

// ── Resource request / review notifications ──────────────

type ResourceRef = {
  id: string;
  name: string;
  sourceType: string;
  cost: string | number | null;
  currency: string | null;
  quantity: number;
  notes: string | null;
};

export type NotifyResourceRequestedInput = {
  content: ContentRef & { verticalName?: string | null };
  node: NodeRef;
  resource: ResourceRef;
  requestedBy?: { id: string; name: string; email: string } | null;
  recipientUserIds: string[];
};

export type NotifyResourceReviewedInput = {
  content: ContentRef;
  node: NodeRef;
  resource: ResourceRef & { approvalState: string; reviewNote: string | null };
  reviewedBy?: { id: string; name: string; email: string } | null;
  recipientUserIds: string[];
};

function formatCost(resource: ResourceRef): string {
  if (resource.cost === null || resource.cost === undefined) return "—";
  const currency = resource.currency || "INR";
  return `${currency} ${resource.cost}`;
}

function buildResourceRequestCopy(input: NotifyResourceRequestedInput) {
  const { content, node, resource, requestedBy } = input;
  const verticalLabel = content.verticalName ? ` (${content.verticalName})` : "";
  const title = `Approval needed: rental resource on "${content.title}"${verticalLabel}`;
  const link = buildContentLink(content.id, node.id);

  const inAppBody =
    `Approval needed for "${resource.name}" (${formatCost(resource)}) on ` +
    `"${content.title}" — node "${node.name}".`;

  const lines = [
    `A rental resource was requested on "${content.title}" — node "${node.name}" (${node.kind}).`,
    `This node cannot be marked COMPLETED until the resource is approved.`,
    "",
    "Resource details:",
    `  • Name     : ${resource.name}`,
    `  • Quantity : ${resource.quantity}`,
    `  • Cost     : ${formatCost(resource)}`
  ];
  if (resource.notes) lines.push(`  • Notes    : ${resource.notes}`);
  if (requestedBy) {
    lines.push("", `Requested by: ${requestedBy.name} <${requestedBy.email}>`);
  }
  if (link) lines.push("", `Open in app: ${link}`);

  const emailBody = lines.join("\n");

  const html = `
    <p>A <strong>rental resource</strong> was requested on
       "<strong>${escapeHtml(content.title)}</strong>" — node
       "<strong>${escapeHtml(node.name)}</strong>" (${escapeHtml(node.kind)}).</p>
    <p>This node cannot be marked <strong>COMPLETED</strong> until the resource is approved.</p>
    <h4 style="margin-bottom:4px">Resource details</h4>
    <ul>
      <li><strong>Name:</strong> ${escapeHtml(resource.name)}</li>
      <li><strong>Quantity:</strong> ${resource.quantity}</li>
      <li><strong>Cost:</strong> ${escapeHtml(formatCost(resource))}</li>
      ${
        resource.notes
          ? `<li><strong>Notes:</strong> ${escapeHtml(resource.notes)}</li>`
          : ""
      }
    </ul>
    ${
      requestedBy
        ? `<p>Requested by ${escapeHtml(requestedBy.name)} &lt;${escapeHtml(
            requestedBy.email
          )}&gt;</p>`
        : ""
    }
    ${link ? `<p><a href="${escapeAttr(link)}">Open in Bran</a></p>` : ""}
  `.trim();

  return { title, inAppBody, emailBody, html };
}

function buildResourceReviewedCopy(input: NotifyResourceReviewedInput) {
  const { content, node, resource, reviewedBy } = input;
  const stateLabel = resource.approvalState.toLowerCase();
  const title = `Rental resource ${stateLabel}: "${resource.name}" on "${content.title}"`;
  const link = buildContentLink(content.id, node.id);

  const inAppBody =
    `"${resource.name}" was ${stateLabel} on "${content.title}" — node "${node.name}".`;

  const lines = [
    `Your rental resource request on "${content.title}" — node "${node.name}" — was ${resource.approvalState}.`,
    "",
    "Resource:",
    `  • Name     : ${resource.name}`,
    `  • Quantity : ${resource.quantity}`,
    `  • Cost     : ${formatCost(resource)}`
  ];
  if (resource.reviewNote) lines.push(`  • Note     : ${resource.reviewNote}`);
  if (reviewedBy) {
    lines.push("", `Reviewed by: ${reviewedBy.name} <${reviewedBy.email}>`);
  }
  if (link) lines.push("", `Open in app: ${link}`);

  const emailBody = lines.join("\n");

  const html = `
    <p>Your rental resource request on
       "<strong>${escapeHtml(content.title)}</strong>" — node
       "<strong>${escapeHtml(node.name)}</strong>" — was
       <strong>${escapeHtml(resource.approvalState)}</strong>.</p>
    <ul>
      <li><strong>Name:</strong> ${escapeHtml(resource.name)}</li>
      <li><strong>Quantity:</strong> ${resource.quantity}</li>
      <li><strong>Cost:</strong> ${escapeHtml(formatCost(resource))}</li>
      ${
        resource.reviewNote
          ? `<li><strong>Note:</strong> ${escapeHtml(resource.reviewNote)}</li>`
          : ""
      }
    </ul>
    ${
      reviewedBy
        ? `<p>Reviewed by ${escapeHtml(reviewedBy.name)} &lt;${escapeHtml(
            reviewedBy.email
          )}&gt;</p>`
        : ""
    }
    ${link ? `<p><a href="${escapeAttr(link)}">Open in Bran</a></p>` : ""}
  `.trim();

  return { title, inAppBody, emailBody, html };
}

async function dispatch(
  recipientUserIds: string[],
  copy: { title: string; inAppBody: string; emailBody: string; html: string },
  payload: unknown,
  kind: string,
  dedupeKey: string
): Promise<{ recipients: number; emailed: number }> {
  const ids = Array.from(new Set(recipientUserIds)).filter(Boolean);
  if (ids.length === 0) return { recipients: 0, emailed: 0 };

  const users = await prisma.user.findMany({
    where: { id: { in: ids }, isActive: true },
    select: { id: true, email: true, name: true }
  });
  if (users.length === 0) return { recipients: 0, emailed: 0 };

  let emailed = 0;
  for (const user of users) {
    const notification = await createNotification({
      userId: user.id,
      kind,
      title: copy.title,
      body: copy.inAppBody,
      data: payload,
      dedupeKey
    });

    if (notification.emailSentAt) continue;
    if (!user.email) continue;
    const sent = await sendEmail({
      to: user.email,
      subject: copy.title,
      text: copy.emailBody,
      html: copy.html
    });
    if (sent) {
      emailed += 1;
      await markEmailSent(notification.id);
    }
  }

  return { recipients: users.length, emailed };
}

type UserRef = {
  id: string;
  name: string;
  email: string;
};

export type NotifyIdeaCollaboratorMatchInput = {
  sourceIdea: {
    id: string;
    title: string;
    description: string;
    authorId: string;
  };
  matchedIdea: {
    id: string;
  };
  sourceUser: UserRef;
  matchedUserId: string;
  similarityScore: number;
};

function buildIdeaMatchCopy(input: NotifyIdeaCollaboratorMatchInput, recipientName?: string) {
  const title = "New collaborator suggestion from ideation";
  const link = buildIdeationLink(input.sourceIdea.id);
  const scorePct = `${Math.round(input.similarityScore * 100)}%`;
  const intro = recipientName ? `${recipientName}, ` : "";

  const inAppBody =
    `${intro}${input.sourceUser.name} has a similar idea ("${input.sourceIdea.title}"). ` +
    `Similarity score: ${scorePct}.`;

  const lines = [
    `${input.sourceUser.name} submitted an idea similar to yours.`,
    "",
    `Idea title: ${input.sourceIdea.title}`,
    `Similarity score: ${scorePct}`,
    "",
    `Reach out to ${input.sourceUser.name} to collaborate.`
  ];
  if (link) {
    lines.push("", `Open in app: ${link}`);
  }
  const emailBody = lines.join("\n");

  const html = `
    <p>${intro}<strong>${escapeHtml(input.sourceUser.name)}</strong> submitted an idea similar to yours.</p>
    <p><strong>Idea title:</strong> ${escapeHtml(input.sourceIdea.title)}</p>
    <p><strong>Similarity score:</strong> ${escapeHtml(scorePct)}</p>
    <p>Reach out to <strong>${escapeHtml(input.sourceUser.name)}</strong> to collaborate.</p>
    ${link ? `<p><a href="${escapeAttr(link)}">Open in Bran</a></p>` : ""}
  `.trim();

  return { title, inAppBody, emailBody, html };
}

export async function notifyIdeaCollaboratorMatch(
  input: NotifyIdeaCollaboratorMatchInput
): Promise<{ recipients: number; emailed: number }> {
  const [sourceUser, matchedUser] = await Promise.all([
    prisma.user.findUnique({
      where: { id: input.sourceUser.id, isActive: true },
      select: { id: true, name: true, email: true }
    }),
    prisma.user.findUnique({
      where: { id: input.matchedUserId, isActive: true },
      select: { id: true, name: true, email: true }
    })
  ]);

  if (!sourceUser || !matchedUser) {
    return { recipients: 0, emailed: 0 };
  }

  const payload = {
    sourceIdea: input.sourceIdea,
    matchedIdea: input.matchedIdea,
    sourceUser: {
      id: sourceUser.id,
      name: sourceUser.name
    },
    matchedUser: {
      id: matchedUser.id,
      name: matchedUser.name
    },
    similarityScore: input.similarityScore,
    link: buildIdeationLink(input.sourceIdea.id) || undefined
  };
  const roundedScore = Math.round(input.similarityScore * 1_000_000);
  const pairKey = [sourceUser.id, matchedUser.id].sort().join(":");
  const dedupeKey = `idea_collaborator_match:${pairKey}:${input.sourceIdea.id}:${input.matchedIdea.id}:${roundedScore}`;

  const sourceCopy = buildIdeaMatchCopy(input);
  const matchedCopy = buildIdeaMatchCopy(input, matchedUser.name);
  const sourceToMatched = await dispatch(
    [matchedUser.id],
    matchedCopy,
    payload,
    "IDEA_COLLABORATOR_MATCH",
    dedupeKey
  );
  const matchedToSource = await dispatch(
    [sourceUser.id],
    sourceCopy,
    payload,
    "IDEA_COLLABORATOR_MATCH",
    dedupeKey
  );

  return {
    recipients: sourceToMatched.recipients + matchedToSource.recipients,
    emailed: sourceToMatched.emailed + matchedToSource.emailed
  };
}

/**
 * Notify the vertical head (and any explicit recipients) that a RENTAL
 * resource has been requested on a content node. Idempotent per
 * (recipient, resource).
 */
export async function notifyResourceRequested(
  input: NotifyResourceRequestedInput
): Promise<{ recipients: number; emailed: number }> {
  const copy = buildResourceRequestCopy(input);
  const dedupeKey = `content_resource_requested:${input.resource.id}`;
  const payload = {
    contentId: input.content.id,
    contentTitle: input.content.title,
    verticalName: input.content.verticalName ?? null,
    node: input.node,
    resource: input.resource,
    requestedBy: input.requestedBy ?? null,
    link: buildContentLink(input.content.id, input.node.id) || undefined
  };
  return dispatch(
    input.recipientUserIds,
    copy,
    payload,
    "CONTENT_RESOURCE_REQUESTED",
    dedupeKey
  );
}

/**
 * Notify the requester (and any extra recipients) that the vertical head
 * has approved or rejected their rental resource. Dedupe key includes the
 * resulting state so an APPROVED follow-up after a REJECTED still fires.
 */
export async function notifyResourceReviewed(
  input: NotifyResourceReviewedInput
): Promise<{ recipients: number; emailed: number }> {
  const copy = buildResourceReviewedCopy(input);
  const dedupeKey = `content_resource_reviewed:${input.resource.id}:${input.resource.approvalState}`;
  const payload = {
    contentId: input.content.id,
    contentTitle: input.content.title,
    node: input.node,
    resource: input.resource,
    reviewedBy: input.reviewedBy ?? null,
    link: buildContentLink(input.content.id, input.node.id) || undefined
  };
  return dispatch(
    input.recipientUserIds,
    copy,
    payload,
    "CONTENT_RESOURCE_REVIEWED",
    dedupeKey
  );
}

// ── Read-side service used by routes ──────────────────────

export async function listMyNotifications(filters: ListNotificationsFilters) {
  return listNotifications(filters);
}

export async function getMyUnreadCount(userId: string) {
  return countUnread(userId);
}

export async function markRead(notificationId: string, userId: string) {
  const existing = await getNotificationByIdForUser(notificationId, userId);
  if (!existing) throw new HttpError(404, "Notification not found");
  await markNotificationRead(notificationId, userId);
  return { id: notificationId, readAt: existing.readAt ?? new Date() };
}

export async function markAllRead(userId: string) {
  const result = await markAllNotificationsRead(userId);
  return { updated: result.count };
}

export type CreateNotificationServiceInput = CreateNotificationInput;

// ── Work unit / step assignment & overdue notifications ──

export type NotifyWorkUnitAssignedInput = {
  workUnitId: string;
  workUnitTitle: string;
  assignedToUserId: string;
  createdByUser: { id: string; name: string };
};

export async function notifyWorkUnitAssigned(
  input: NotifyWorkUnitAssignedInput
): Promise<void> {
  const link = buildWorkUnitLink(input.workUnitId);
  const title = `${input.createdByUser.name} assigned you a work unit`;
  const body = `"${input.workUnitTitle}" was assigned to you by ${input.createdByUser.name}.`;
  const dedupeKey = `work_unit_assigned:${input.workUnitId}:${input.assignedToUserId}`;

  const user = await prisma.user.findUnique({
    where: { id: input.assignedToUserId, isActive: true },
    select: { id: true, email: true, name: true }
  });
  if (!user) return;

  const notification = await createNotification({
    userId: user.id,
    kind: "WORK_UNIT_ASSIGNED",
    title,
    body,
    data: { workUnitId: input.workUnitId, workUnitTitle: input.workUnitTitle, createdByUser: input.createdByUser, link: link || undefined },
    dedupeKey
  });

  if (!notification.emailSentAt && user.email) {
    const emailLines = [body, ...(link ? ["", `Open in app: ${link}`] : [])];
    const sent = await sendEmail({
      to: user.email,
      subject: title,
      text: emailLines.join("\n"),
      html: `<p>${escapeHtml(body)}</p>${link ? `<p><a href="${escapeAttr(link)}">Open in Bran</a></p>` : ""}`
    });
    if (sent) await markEmailSent(notification.id);
  }
}

export type NotifyWorkStepAssignedInput = {
  workUnitId: string;
  workUnitTitle: string;
  stepDescription: string;
  stepDeadline: Date | null;
  assignedToUserId: string;
  assignedByUser: { id: string; name: string };
};

export async function notifyWorkStepAssigned(
  input: NotifyWorkStepAssignedInput
): Promise<void> {
  const link = buildWorkUnitLink(input.workUnitId);
  const deadlineNote = input.stepDeadline
    ? ` (due ${input.stepDeadline.toLocaleDateString("en-IN")})`
    : "";
  const title = `${input.assignedByUser.name} assigned you a task`;
  const body = `You were assigned a step on "${input.workUnitTitle}"${deadlineNote}: "${input.stepDescription}".`;
  const dedupeKey = `work_step_assigned:${input.workUnitId}:${input.assignedToUserId}:${input.stepDescription.slice(0, 60)}`;

  const user = await prisma.user.findUnique({
    where: { id: input.assignedToUserId, isActive: true },
    select: { id: true, email: true, name: true }
  });
  if (!user) return;

  const notification = await createNotification({
    userId: user.id,
    kind: "WORK_STEP_ASSIGNED",
    title,
    body,
    data: { workUnitId: input.workUnitId, workUnitTitle: input.workUnitTitle, stepDescription: input.stepDescription, assignedByUser: input.assignedByUser, link: link || undefined },
    dedupeKey
  });

  if (!notification.emailSentAt && user.email) {
    const emailLines = [body, ...(link ? ["", `Open in app: ${link}`] : [])];
    const sent = await sendEmail({
      to: user.email,
      subject: title,
      text: emailLines.join("\n"),
      html: `<p>${escapeHtml(body)}</p>${link ? `<p><a href="${escapeAttr(link)}">Open in Bran</a></p>` : ""}`
    });
    if (sent) await markEmailSent(notification.id);
  }
}

export type NotifyWorkStepOverdueInput = {
  workUnitId: string;
  workUnitTitle: string;
  stepId: string;
  stepDescription: string;
  stepDeadline: Date;
  recipientUserId: string;
  overdueDate: string; // YYYY-MM-DD — used in dedupeKey to fire once per day
};

export async function notifyWorkStepOverdue(
  input: NotifyWorkStepOverdueInput
): Promise<void> {
  const link = buildWorkUnitLink(input.workUnitId);
  const deadlineStr = input.stepDeadline.toLocaleDateString("en-IN");
  const title = `Overdue task: "${input.stepDescription.slice(0, 60)}"`;
  const body = `A step on "${input.workUnitTitle}" was due on ${deadlineStr} and is still open.`;
  const dedupeKey = `work_step_overdue:${input.stepId}:${input.overdueDate}`;

  const user = await prisma.user.findUnique({
    where: { id: input.recipientUserId, isActive: true },
    select: { id: true, email: true }
  });
  if (!user) return;

  const notification = await createNotification({
    userId: user.id,
    kind: "WORK_STEP_OVERDUE",
    title,
    body,
    data: { workUnitId: input.workUnitId, workUnitTitle: input.workUnitTitle, stepId: input.stepId, stepDescription: input.stepDescription, stepDeadline: input.stepDeadline, link: link || undefined },
    dedupeKey
  });

  if (!notification.emailSentAt && user.email) {
    const emailLines = [body, ...(link ? ["", `Open in app: ${link}`] : [])];
    const sent = await sendEmail({
      to: user.email,
      subject: title,
      text: emailLines.join("\n"),
      html: `<p>${escapeHtml(body)}</p>${link ? `<p><a href="${escapeAttr(link)}">Open in Bran</a></p>` : ""}`
    });
    if (sent) await markEmailSent(notification.id);
  }
}

// ── Attendance WFH → manager notifications ───────────────

export type NotifyWfhToManagerInput = {
  /** Slack profile email used to match an onboarded Bran user. */
  employeeEmail: string;
  employeeName?: string | null;
  entryDate: string; // YYYY-MM-DD IST
  rawMessage?: string | null;
};

/**
 * When someone posts WFH, notify their manager (in-app + email).
 *
 * Matching rules:
 * - Slack email must match an active onboarded User (case-insensitive).
 * - That user must have managerUserId set to an active manager.
 * - Anyone not onboarded / without a manager is skipped silently.
 * - Idempotent per (manager, employee, date) via dedupeKey.
 */
export async function notifyWfhToManager(
  input: NotifyWfhToManagerInput
): Promise<{ notified: boolean; reason?: string }> {
  const email = input.employeeEmail.trim().toLowerCase();
  if (!email) {
    return { notified: false, reason: "missing_email" };
  }

  const employee = await prisma.user.findFirst({
    where: {
      isActive: true,
      email: { equals: email, mode: "insensitive" }
    },
    select: {
      id: true,
      name: true,
      email: true,
      managerUserId: true,
      manager: {
        select: { id: true, name: true, email: true, isActive: true }
      }
    }
  });

  if (!employee) {
    return { notified: false, reason: "user_not_onboarded" };
  }

  const manager = employee.manager;
  if (!employee.managerUserId || !manager || !manager.isActive) {
    return { notified: false, reason: "no_active_manager" };
  }

  const displayName = input.employeeName?.trim() || employee.name;
  const link = buildAttendanceLink(input.entryDate);
  const title = `${displayName} is working from home today`;
  const body = `${displayName} let the team know they'll be working from home on ${input.entryDate}. Just a heads-up so you're in the loop.`;
  const dedupeKey = `attendance_wfh:${employee.id}:${input.entryDate}`;

  const payload = {
    kind: "ATTENDANCE_WFH",
    entryDate: input.entryDate,
    employee: {
      id: employee.id,
      name: employee.name,
      email: employee.email
    },
    rawMessage: input.rawMessage ?? null,
    link: link || undefined
  };

  const notification = await createNotification({
    userId: manager.id,
    kind: "ATTENDANCE_WFH",
    title,
    body,
    data: payload,
    dedupeKey
  });

  if (!notification.emailSentAt && manager.email) {
    const lines = [
      body,
      "",
      `Employee: ${employee.name} <${employee.email}>`,
      `Date: ${input.entryDate}`,
      ...(input.rawMessage ? [`Slack message: ${input.rawMessage}`] : []),
      ...(link ? ["", `Open in app: ${link}`] : [])
    ];
    const html = `
      <p>${escapeHtml(body)}</p>
      <ul>
        <li><strong>Employee:</strong> ${escapeHtml(employee.name)} &lt;${escapeHtml(employee.email)}&gt;</li>
        <li><strong>Date:</strong> ${escapeHtml(input.entryDate)}</li>
        ${
          input.rawMessage
            ? `<li><strong>Slack message:</strong> ${escapeHtml(input.rawMessage)}</li>`
            : ""
        }
      </ul>
      ${link ? `<p><a href="${escapeAttr(link)}">Open attendance in Bran</a></p>` : ""}
    `.trim();

    const sent = await sendEmail({
      to: manager.email,
      subject: title,
      text: lines.join("\n"),
      html
    });
    if (sent) await markEmailSent(notification.id);
  }

  return { notified: true };
}

// ── Content ops hub (shoot brief / edit / build) ─────────

function opsDedupeKey(kind: string, nodeId: string, userId: string): string {
  const minute = new Date().toISOString().slice(0, 16);
  return `ops:${kind}:${nodeId}:${userId}:${minute}`;
}

function formatOpsDateTime(value: Date | null | undefined): string {
  if (!value) return "—";
  return value.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: env.appTimezone
  });
}

async function notifyOpsRecipient(input: {
  userId: string;
  kind: string;
  title: string;
  body: string;
  emailLines: string[];
  dedupeKind: string;
  nodeId: string;
  data: Record<string, unknown>;
  link?: string;
}): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: input.userId, isActive: true },
    select: { id: true, email: true, name: true }
  });
  if (!user) return;

  const notification = await createNotification({
    userId: user.id,
    kind: input.kind,
    title: input.title,
    body: input.body,
    data: { ...input.data, link: input.link || undefined },
    dedupeKey: opsDedupeKey(input.dedupeKind, input.nodeId, user.id)
  });

  if (!notification.emailSentAt && user.email) {
    const text = [...input.emailLines, ...(input.link ? ["", `Open in app: ${input.link}`] : [])].join(
      "\n"
    );
    const htmlBody = input.emailLines.map((line) => `<p>${escapeHtml(line)}</p>`).join("");
    const sent = await sendEmail({
      to: user.email,
      subject: input.title,
      text,
      html: `${htmlBody}${input.link ? `<p><a href="${escapeAttr(input.link)}">Open in Bran</a></p>` : ""}`
    });
    if (sent) await markEmailSent(notification.id);
  }
}

export type NotifyShootBriefDispatchedInput = {
  contentId: string;
  contentTitle: string;
  nodeId: string;
  location: string;
  callTime: Date;
  wrapTime?: Date | null;
  scriptLink?: string | null;
  scenes?: string | null;
  notes?: string | null;
  equipment: string[];
  recipientUserIds: string[];
};

export async function notifyShootBriefDispatched(
  input: NotifyShootBriefDispatchedInput
): Promise<void> {
  const link = buildContentLink(input.contentId, input.nodeId);
  const title = `Shoot brief — ${input.contentTitle}`;
  const callStr = formatOpsDateTime(input.callTime);
  const wrapStr = input.wrapTime ? formatOpsDateTime(input.wrapTime) : "—";

  const detailLines = [
    `Video: ${input.contentTitle}`,
    `Location: ${input.location}`,
    `Call time: ${callStr}`,
    `Wrap: ${wrapStr}`,
    ...(input.scenes ? [`Scenes: ${input.scenes}`] : []),
    ...(input.scriptLink ? [`Script: ${input.scriptLink}`] : []),
    ...(input.equipment.length > 0
      ? [`Equipment: ${input.equipment.join(", ")}`]
      : []),
    ...(input.notes ? [`Notes: ${input.notes}`] : [])
  ];

  const body = `You are on set for "${input.contentTitle}" at ${input.location}. Call ${callStr}.`;

  await Promise.all(
    input.recipientUserIds.map((userId) =>
      notifyOpsRecipient({
        userId,
        kind: "SHOOT_BRIEF_DISPATCHED",
        title,
        body,
        emailLines: ["Shoot brief dispatched.", "", ...detailLines],
        dedupeKind: "shoot-brief",
        nodeId: input.nodeId,
        data: {
          contentId: input.contentId,
          contentTitle: input.contentTitle,
          nodeId: input.nodeId,
          location: input.location,
          callTime: input.callTime.toISOString(),
          wrapTime: input.wrapTime?.toISOString() ?? null,
          equipment: input.equipment
        },
        link: link || undefined
      })
    )
  );
}

export type NotifyEditAssignedInput = {
  contentId: string;
  contentTitle: string;
  nodeId: string;
  editorUserId: string;
  deadline: Date;
  footage?: string | null;
  notes?: string | null;
};

export async function notifyEditAssigned(input: NotifyEditAssignedInput): Promise<void> {
  const link = buildContentLink(input.contentId, input.nodeId);
  const deadlineStr = formatOpsDateTime(input.deadline);
  const title = `Edit assigned — ${input.contentTitle}`;
  const body = `You were assigned to edit "${input.contentTitle}". First cut due ${deadlineStr}.`;

  const detailLines = [
    `Video: ${input.contentTitle}`,
    `First cut due: ${deadlineStr}`,
    ...(input.footage ? [`Footage: ${input.footage}`] : []),
    ...(input.notes ? [`Notes: ${input.notes}`] : [])
  ];

  await notifyOpsRecipient({
    userId: input.editorUserId,
    kind: "EDIT_ASSIGNED",
    title,
    body,
    emailLines: ["Edit assignment dispatched.", "", ...detailLines],
    dedupeKind: "edit-assigned",
    nodeId: input.nodeId,
    data: {
      contentId: input.contentId,
      contentTitle: input.contentTitle,
      nodeId: input.nodeId,
      deadline: input.deadline.toISOString(),
      footage: input.footage ?? null,
      notes: input.notes ?? null
    },
    link: link || undefined
  });
}

export type NotifyBuildAssignedInput = {
  contentId: string;
  contentTitle: string;
  nodeId: string;
  projectName: string;
  phase?: string | null;
  deadline: Date;
  materials?: string | null;
  files?: string | null;
  notes?: string | null;
  recipientUserIds: string[];
};

export async function notifyBuildAssigned(input: NotifyBuildAssignedInput): Promise<void> {
  const link = buildContentLink(input.contentId, input.nodeId);
  const deadlineStr = formatOpsDateTime(input.deadline);
  const title = `Build assigned — ${input.projectName}`;
  const body = `You were assigned to build "${input.projectName}" for "${input.contentTitle}". Shoot-ready by ${deadlineStr}.`;

  const detailLines = [
    `Project: ${input.projectName}`,
    `For video: ${input.contentTitle}`,
    ...(input.phase ? [`Phase: ${input.phase}`] : []),
    `Shoot-ready by: ${deadlineStr}`,
    ...(input.materials ? [`Materials: ${input.materials}`] : []),
    ...(input.files ? [`Files: ${input.files}`] : []),
    ...(input.notes ? [`Notes: ${input.notes}`] : [])
  ];

  await Promise.all(
    input.recipientUserIds.map((userId) =>
      notifyOpsRecipient({
        userId,
        kind: "BUILD_ASSIGNED",
        title,
        body,
        emailLines: ["Build assignment dispatched.", "", ...detailLines],
        dedupeKind: "build-assigned",
        nodeId: input.nodeId,
        data: {
          contentId: input.contentId,
          contentTitle: input.contentTitle,
          nodeId: input.nodeId,
          projectName: input.projectName,
          phase: input.phase ?? null,
          deadline: input.deadline.toISOString()
        },
        link: link || undefined
      })
    )
  );
}
