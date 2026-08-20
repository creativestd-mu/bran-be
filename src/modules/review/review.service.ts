import type { Readable } from "node:stream";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { env } from "../../config/env";
import {
  openStoredFileReadStream,
  saveStoredFile
} from "../../lib/file-storage";
import { HttpError } from "../../utils/httpError";
import { DEFAULT_REVIEW_REMINDER_TIMES, MAX_REVIEW_FILE_BYTES } from "./review.constants";
import type {
  CreateReviewInput,
  ListReviewsQuery,
  RespondReviewInput,
  UpdateReminderPreferencesInput
} from "./review.schemas";
import {
  createReviewRequest,
  findActiveUserById,
  findReviewById,
  getReminderPreference,
  listPendingIncoming,
  listReviewsForUser,
  listUsersNeedingReminder,
  markReminderSent,
  respondToReview,
  setReviewSlackMessage,
  upsertReminderPreference,
  type ReviewWithUsers
} from "./review.repository";
import {
  notifyReviewerOnSlack,
  openReviewResponseModal,
  sendPendingReviewsReminderDm,
  updateReviewSlackCard
} from "./review.slack";

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function attendanceDmAllowlist(): string[] {
  return env.attendanceDmAllowlist
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

function attendanceDmAllowed(email: string | null | undefined): boolean {
  const allowlist = attendanceDmAllowlist();
  if (allowlist.length === 0) return true;
  if (!email) return false;
  return allowlist.includes(email.trim().toLowerCase());
}

function assertCanView(review: ReviewWithUsers, userId: string): void {
  if (review.requestedById !== userId && review.requestedToId !== userId) {
    throw new HttpError(403, "You can only view reviews you sent or received");
  }
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 180) || "file";
}

export async function createReview(
  actorUserId: string,
  input: CreateReviewInput,
  file?: Express.Multer.File
): Promise<ReviewWithUsers> {
  if (input.requestedToId === actorUserId) {
    throw new HttpError(400, "You cannot request a review from yourself");
  }

  const recipient = await findActiveUserById(input.requestedToId);
  if (!recipient) {
    throw new HttpError(404, "Recipient user not found");
  }

  const hasLink = Boolean(input.fileUrl);
  const hasFile = Boolean(file);
  if (!hasLink && !hasFile) {
    throw new HttpError(400, "Provide a file link or upload a file");
  }

  let storagePath: string | null = null;
  let fileName: string | null = null;
  let contentType: string | null = null;

  if (file) {
    if (file.size > MAX_REVIEW_FILE_BYTES) {
      throw new HttpError(400, "File exceeds 25 MB limit");
    }
    fileName = sanitizeFileName(file.originalname || "upload");
    contentType = file.mimetype || "application/octet-stream";
    const relativePath = `${actorUserId}/${randomUUID()}-${fileName}`;
    storagePath = await saveStoredFile({
      root: "reviews",
      relativePath,
      buffer: file.buffer,
      contentType
    });
  }

  const review = await createReviewRequest({
    requestedById: actorUserId,
    requestedToId: input.requestedToId,
    context: input.context,
    fileUrl: input.fileUrl ?? null,
    storagePath,
    fileName,
    contentType
  });

  if (env.reviewRemindersEnabled && attendanceDmAllowed(review.requestedTo.email)) {
    try {
      const dm = await notifyReviewerOnSlack(review);
      if (dm) {
        await setReviewSlackMessage({
          id: review.id,
          slackChannelId: dm.channel,
          slackMessageTs: dm.ts
        });
        review.slackChannelId = dm.channel;
        review.slackMessageTs = dm.ts;
      }
    } catch (error) {
      console.error("[review] Failed to notify reviewer on Slack:", error);
    }
  } else if (!attendanceDmAllowed(review.requestedTo.email)) {
    console.log(
      `[review] Slack notify skipped — ${review.requestedTo.email} not in ATTENDANCE_DM_ALLOWLIST`
    );
  }

  return review;
}

export async function listMyReviews(
  actorUserId: string,
  query: ListReviewsQuery
): Promise<ReviewWithUsers[]> {
  return listReviewsForUser({
    userId: actorUserId,
    direction: query.direction,
    status: query.status
  });
}

export async function getReview(
  actorUserId: string,
  reviewId: string
): Promise<ReviewWithUsers> {
  const review = await findReviewById(reviewId);
  if (!review) {
    throw new HttpError(404, "Review not found");
  }
  assertCanView(review, actorUserId);
  return review;
}

export async function respondToReviewRequest(
  actorUserId: string,
  reviewId: string,
  input: RespondReviewInput
): Promise<ReviewWithUsers> {
  const review = await findReviewById(reviewId);
  if (!review) {
    throw new HttpError(404, "Review not found");
  }
  if (review.requestedToId !== actorUserId) {
    throw new HttpError(403, "Only the requested reviewer can accept or reject");
  }
  if (review.status !== "pending") {
    throw new HttpError(400, `Review already ${review.status}`);
  }

  const updated = await respondToReview({
    id: reviewId,
    status: input.decision,
    responseComment: input.comment,
    respondedAt: new Date()
  });

  try {
    await updateReviewSlackCard(updated);
  } catch (error) {
    console.error("[review] Failed to update Slack card:", error);
  }

  // Notify requester via Slack DM (best-effort)
  if (env.reviewRemindersEnabled && attendanceDmAllowed(updated.requestedBy.email)) {
    try {
      const { lookupSlackUserByEmail, sendDm } = await import("../attendance/attendance.slack.js");
      const slackUser = await lookupSlackUserByEmail(updated.requestedBy.email);
      if (slackUser?.id) {
        const label = input.decision === "accepted" ? "accepted" : "rejected";
        await sendDm(
          slackUser.id,
          [
            `Your review request was *${label}* by ${updated.requestedTo.name}.`,
            "",
            `Comment: ${input.comment}`,
            "",
            `Context: ${updated.context.slice(0, 200)}`
          ].join("\n")
        );
      }
    } catch (error) {
      console.error("[review] Failed to notify requester on Slack:", error);
    }
  }

  return updated;
}

/**
 * Slack modal open: verify the clicker is the reviewer, then open comment modal.
 */
export async function handleReviewSlackAction(input: {
  slackUserId: string;
  reviewId: string;
  decision: "accepted" | "rejected";
  triggerId: string;
}): Promise<void> {
  const { resolveBranUserIdForSlackUser } = await import("../work/work.slack.js");
  const branUserId = await resolveBranUserIdForSlackUser(input.slackUserId);
  if (!branUserId) {
    throw new HttpError(403, "Slack user is not linked to a Bran account");
  }

  const review = await findReviewById(input.reviewId);
  if (!review) {
    throw new HttpError(404, "Review not found");
  }
  if (review.requestedToId !== branUserId) {
    throw new HttpError(403, "Only the assigned reviewer can respond");
  }
  if (review.status !== "pending") {
    throw new HttpError(400, `Review already ${review.status}`);
  }

  await openReviewResponseModal({
    triggerId: input.triggerId,
    reviewId: review.id,
    decision: input.decision,
    requesterName: review.requestedBy.name
  });
}

/**
 * Slack /review modal submission: create a review as the Slack user.
 * Returns the created review, or a field-level error to show in the modal.
 */
export async function createReviewFromSlack(input: {
  requesterSlackUserId: string;
  recipientSlackUserId: string;
  context: string;
  fileUrl?: string | null;
}): Promise<
  | { ok: true; review: ReviewWithUsers }
  | { ok: false; field: "user" | "context" | "file"; message: string }
> {
  const { resolveBranUserIdForSlackUser } = await import("../work/work.slack.js");

  const requesterId = await resolveBranUserIdForSlackUser(input.requesterSlackUserId);
  if (!requesterId) {
    return {
      ok: false,
      field: "user",
      message: "Your Slack account isn't linked to a Bran user. Ask an admin to add your email."
    };
  }

  const recipientId = await resolveBranUserIdForSlackUser(input.recipientSlackUserId);
  if (!recipientId) {
    return {
      ok: false,
      field: "user",
      message: "That teammate isn't a Bran user yet (email must match)."
    };
  }
  if (recipientId === requesterId) {
    return { ok: false, field: "user", message: "You can't request a review from yourself." };
  }

  const context = input.context.trim();
  if (!context) {
    return { ok: false, field: "context", message: "Add some context." };
  }

  const fileUrl = input.fileUrl?.trim() || "";
  if (!fileUrl) {
    return { ok: false, field: "file", message: "Add a file link." };
  }
  try {
    // eslint-disable-next-line no-new
    new URL(fileUrl);
  } catch {
    return { ok: false, field: "file", message: "Enter a valid URL (https://…)." };
  }

  const review = await createReview(requesterId, {
    requestedToId: recipientId,
    context,
    fileUrl
  });

  return { ok: true, review };
}

/**
 * Slack view_submission: respond to the review as the Slack user.
 */
export async function handleReviewSlackModalSubmit(input: {
  slackUserId: string;
  reviewId: string;
  decision: "accepted" | "rejected";
  comment: string;
}): Promise<ReviewWithUsers> {
  const { resolveBranUserIdForSlackUser } = await import("../work/work.slack.js");
  const branUserId = await resolveBranUserIdForSlackUser(input.slackUserId);
  if (!branUserId) {
    throw new HttpError(403, "Slack user is not linked to a Bran account");
  }

  return respondToReviewRequest(branUserId, input.reviewId, {
    decision: input.decision,
    comment: input.comment
  });
}

export async function resolveReviewFileStream(
  actorUserId: string,
  reviewId: string
): Promise<{ stream: Readable; fileName: string; contentType: string }> {
  const review = await getReview(actorUserId, reviewId);
  if (!review.storagePath) {
    throw new HttpError(404, "This review has no uploaded file");
  }
  const stream = await openStoredFileReadStream("reviews", review.storagePath);
  return {
    stream,
    fileName: review.fileName || path.basename(review.storagePath),
    contentType: review.contentType || "application/octet-stream"
  };
}

export async function getMyReminderPreferences(userId: string) {
  const pref = await getReminderPreference(userId);
  return {
    times: pref?.times?.length ? pref.times : [...DEFAULT_REVIEW_REMINDER_TIMES],
    enabled: pref?.enabled ?? true,
    lastRemindedSlot: pref?.lastRemindedSlot ?? null,
    lastRemindedOn: pref?.lastRemindedOn ?? null
  };
}

export async function updateMyReminderPreferences(
  userId: string,
  input: UpdateReminderPreferencesInput
) {
  const uniqueTimes = [...new Set(input.times)].sort();
  const pref = await upsertReminderPreference({
    userId,
    times: uniqueTimes,
    enabled: input.enabled
  });
  return {
    times: pref.times,
    enabled: pref.enabled,
    lastRemindedSlot: pref.lastRemindedSlot,
    lastRemindedOn: pref.lastRemindedOn
  };
}

/** Current IST calendar date YYYY-MM-DD and HH:mm. */
export function currentIstDateAndSlot(from: Date = new Date()): {
  dateIst: string;
  slot: string;
} {
  const ist = new Date(from.getTime() + IST_OFFSET_MS);
  const year = ist.getUTCFullYear();
  const month = String(ist.getUTCMonth() + 1).padStart(2, "0");
  const day = String(ist.getUTCDate()).padStart(2, "0");
  const hour = String(ist.getUTCHours()).padStart(2, "0");
  const minute = String(ist.getUTCMinutes()).padStart(2, "0");
  return {
    dateIst: `${year}-${month}-${day}`,
    slot: `${hour}:${minute}`
  };
}

export async function runReviewReminders(now: Date = new Date()): Promise<{
  slot: string;
  dateIst: string;
  candidates: number;
  sent: number;
  skippedAllowlist: number;
  errors: number;
}> {
  const { dateIst, slot } = currentIstDateAndSlot(now);
  const candidates = await listUsersNeedingReminder(slot, dateIst);
  let sent = 0;
  let skippedAllowlist = 0;
  let errors = 0;

  for (const user of candidates) {
    if (!attendanceDmAllowed(user.email)) {
      skippedAllowlist += 1;
      continue;
    }
    try {
      const reviews = await listPendingIncoming(user.userId);
      if (reviews.length === 0) {
        await markReminderSent({ userId: user.userId, slot, dateIst });
        continue;
      }
      const ok = await sendPendingReviewsReminderDm({
        email: user.email,
        name: user.name,
        reviews
      });
      if (ok) {
        sent += 1;
      }
      await markReminderSent({ userId: user.userId, slot, dateIst });
    } catch (error) {
      errors += 1;
      console.error(`[review-reminders] Failed for ${user.email}:`, error);
    }
  }

  return {
    slot,
    dateIst,
    candidates: candidates.length,
    sent,
    skippedAllowlist,
    errors
  };
}
