import type { NextFunction, Request, Response } from "express";

import { env } from "../../config/env";
import { HttpError } from "../../utils/httpError";
import { AUTO_REMINDERS_ENABLED } from "./attendance.constants";
import { todayInIST } from "./attendance.dates";
import { parseAttendanceMessage } from "./attendance.parser";
import { upsertSlackMember } from "./attendance.repository";
import {
  processSlackChannelMessage,
  runEtaCheck,
  submitAttendanceFromSlack
} from "./attendance.service";
import {
  getSlackUserInfo,
  resolveChannelId,
  verifySlackSignature
} from "./attendance.slack";
import { processSlackEscalationMessage } from "../escalation/escalation.service";
import { processSlackCompetitorMessage } from "../competitor-content/competitor-content.slack";
import { processSlackSentimentMessage } from "../sentiment/sentiment.slack";
import {
  processSlackDmWorkCreateMessage,
  processSlackTaskListMessage,
  processSlackVoiceWorkConfirm,
  processSlackVoiceWorkMessage,
  processSlackWorkChecklistAction,
  processSlackWorkMessage
} from "../work/work.service";
import { SLACK_WORK_COMPLETE_ACTION } from "../work/work.slack-tasks";
import { hasSlackAudioFiles, isSlackDmChannel } from "../work/work.slack-voice";

async function processSlackInteractiveQuery(input: {
  channelId: string;
  userId: string;
  text?: string;
  ts: string;
  botId?: string;
  subtype?: string;
  threadTs?: string;
  channelType?: string;
}): Promise<{ handled: boolean; reason?: string }> {
  const competitor = await processSlackCompetitorMessage(input);
  if (competitor.handled) {
    return competitor;
  }
  const sentiment = await processSlackSentimentMessage(input);
  if (sentiment.handled) {
    return sentiment;
  }
  return processSlackTaskListMessage(input);
}

function readRawBodyBuffer(req: Request): Buffer {
  if (Buffer.isBuffer(req.body)) {
    return req.body;
  }
  if (typeof req.body === "string") {
    return Buffer.from(req.body, "utf8");
  }
  // Body was parsed/rewritten — signature will almost certainly fail.
  console.warn(
    "[slack-webhook] Request body is not a raw Buffer; Slack signature verification will likely fail"
  );
  return Buffer.from(JSON.stringify(req.body ?? {}), "utf8");
}

function assertSlackSignature(req: Request, rawBody: Buffer): void {
  if (!env.slackSigningSecret) {
    throw new HttpError(500, "SLACK_SIGNING_SECRET is not configured");
  }

  const result = verifySlackSignature({
    signingSecret: env.slackSigningSecret,
    signature: req.header("x-slack-signature") ?? undefined,
    timestamp: req.header("x-slack-request-timestamp") ?? undefined,
    rawBody
  });

  if (!result.ok) {
    console.error("[slack-webhook] Signature verification failed:", {
      reason: result.reason,
      detail: result.detail,
      contentType: req.header("content-type") ?? null,
      bodyIsBuffer: Buffer.isBuffer(req.body)
    });
    throw new HttpError(401, `Invalid Slack signature (${result.reason})`);
  }
}

/**
 * POST /api/slack/events — Slack Event Subscriptions webhook.
 * Responds quickly; attendance processing is fire-and-forget.
 *
 * url_verification is answered before signature checks so Slack's
 * Request URL handshake can succeed even before secrets are perfect.
 * All real events still require a valid Slack signature.
 */
export async function slackEventsHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const rawBody = readRawBodyBuffer(req);

    let payload: {
      type?: string;
      challenge?: string;
      event?: {
        type?: string;
        channel?: string;
        user?: string;
        text?: string;
        ts?: string;
        bot_id?: string;
        subtype?: string;
        thread_ts?: string;
        channel_type?: string;
        files?: Array<{
          id: string;
          name?: string;
          title?: string;
          mimetype?: string;
          filetype?: string;
          size?: number;
          url_private?: string;
          url_private_download?: string;
          permalink?: string;
          thumb_360?: string;
        }>;
      };
    };

    try {
      payload = JSON.parse(rawBody.toString("utf8")) as typeof payload;
    } catch {
      throw new HttpError(400, "Invalid JSON body");
    }

    // Slack Event URL handshake — must return the challenge value.
    if (payload.type === "url_verification" && payload.challenge) {
      res.status(200).json({ challenge: payload.challenge });
      return;
    }

    assertSlackSignature(req, rawBody);

    // Acknowledge immediately (Slack requires < 3s)
    res.status(200).json({ ok: true });

    const event = payload.event;
    if (!event || (event.type !== "message" && event.type !== "app_mention")) {
      return;
    }

    if (!event.channel || !event.user || !event.ts) {
      return;
    }

    const hasText = Boolean(event.text?.trim());
    const hasFiles = Boolean(event.files?.length);
    const isDm = isSlackDmChannel(event.channel, event.channel_type);
    const hasAudio = hasSlackAudioFiles(event.files);
    const isThreadReply = Boolean(event.thread_ts && event.thread_ts !== event.ts);

    // Voice note → work units (DM, or @Bran + audio in a channel). STT can exceed Slack's 3s ack.
    if (hasAudio) {
      void processSlackVoiceWorkMessage({
        channelId: event.channel,
        userId: event.user,
        ts: event.ts,
        botId: event.bot_id,
        subtype: event.subtype,
        channelType: event.channel_type,
        text: event.text,
        eventType: event.type,
        files: event.files
      }).catch((error) => {
        console.error("Slack voice work event processing failed:", error);
      });
    }

    // Thread confirm/edit for voice drafts — run before attendance so "ok"/"yes"/"create"
    // on a draft thread does not collide with WFH/leave approval replies.
    // Skip attendance entirely for audio messages addressed to Bran.
    if (hasAudio) {
      // voice handler above; no attendance on the audio message itself
    } else if (isThreadReply && hasText) {
      void processSlackVoiceWorkConfirm({
        channelId: event.channel,
        userId: event.user,
        text: event.text,
        ts: event.ts,
        botId: event.bot_id,
        subtype: event.subtype,
        threadTs: event.thread_ts,
        channelType: event.channel_type
      })
        .then((result) => {
          if (result.handled) return;
          return processSlackInteractiveQuery({
            channelId: event.channel!,
            userId: event.user!,
            text: event.text,
            ts: event.ts!,
            botId: event.bot_id,
            subtype: event.subtype,
            threadTs: event.thread_ts,
            channelType: event.channel_type
          }).then((taskResult) => {
            if (taskResult.handled) return;
            return processSlackChannelMessage({
              channelId: event.channel!,
              userId: event.user!,
              text: event.text!,
              ts: event.ts!,
              botId: event.bot_id,
              subtype: event.subtype,
              threadTs: event.thread_ts,
              channelType: event.channel_type
            }).then((attendance) => {
              if (attendance.recorded) return;
              return processSlackDmWorkCreateMessage({
                channelId: event.channel!,
                userId: event.user!,
                text: event.text,
                ts: event.ts!,
                botId: event.bot_id,
                subtype: event.subtype,
                threadTs: event.thread_ts,
                channelType: event.channel_type
              });
            });
          });
        })
        .catch((error) => {
          console.error("Slack voice confirm / task list / attendance processing failed:", error);
        });
    } else if (isDm && hasText) {
      void processSlackInteractiveQuery({
        channelId: event.channel,
        userId: event.user,
        text: event.text,
        ts: event.ts,
        botId: event.bot_id,
        subtype: event.subtype,
        threadTs: event.thread_ts,
        channelType: event.channel_type
      })
        .then((result) => {
          if (result.handled) return;
          return processSlackChannelMessage({
            channelId: event.channel!,
            userId: event.user!,
            text: event.text!,
            ts: event.ts!,
            botId: event.bot_id,
            subtype: event.subtype,
            threadTs: event.thread_ts,
            channelType: event.channel_type
          }).then((attendance) => {
            if (attendance.recorded) return;
            return processSlackDmWorkCreateMessage({
              channelId: event.channel!,
              userId: event.user!,
              text: event.text,
              ts: event.ts!,
              botId: event.bot_id,
              subtype: event.subtype,
              threadTs: event.thread_ts,
              channelType: event.channel_type
            });
          });
        })
        .catch((error) => {
          console.error("Slack sentiment / task list / attendance processing failed:", error);
        });
    } else if (hasText) {
      void processSlackInteractiveQuery({
        channelId: event.channel,
        userId: event.user,
        text: event.text,
        ts: event.ts,
        botId: event.bot_id,
        subtype: event.subtype,
        threadTs: event.thread_ts,
        channelType: event.channel_type
      })
        .then((result) => {
          if (result.handled) return;
          return processSlackChannelMessage({
            channelId: event.channel!,
            userId: event.user!,
            text: event.text!,
            ts: event.ts!,
            botId: event.bot_id,
            subtype: event.subtype,
            threadTs: event.thread_ts,
            channelType: event.channel_type
          });
        })
        .catch((error) => {
          console.error("Slack sentiment / task list / attendance event processing failed:", error);
        });
    }

    if (hasText || hasFiles) {
      void processSlackEscalationMessage({
        channelId: event.channel,
        userId: event.user,
        text: event.text,
        ts: event.ts,
        botId: event.bot_id,
        subtype: event.subtype,
        threadTs: event.thread_ts,
        files: event.files
      }).catch((error) => {
        console.error("Slack escalation event processing failed:", error);
      });
    }

    // Channel text work ingest — skip DMs, voice notes, and @Bran task-list replies.
    if (hasText && !isDm && !hasAudio) {
      void processSlackInteractiveQuery({
        channelId: event.channel,
        userId: event.user,
        text: event.text,
        ts: event.ts,
        botId: event.bot_id,
        subtype: event.subtype,
        threadTs: event.thread_ts,
        channelType: event.channel_type
      })
        .then((result) => {
          if (result.handled) return;
          return processSlackWorkMessage({
            channelId: event.channel!,
            userId: event.user!,
            text: event.text,
            ts: event.ts!,
            botId: event.bot_id,
            subtype: event.subtype,
            threadTs: event.thread_ts
          });
        })
        .catch((error) => {
          console.error("Slack work event processing failed:", error);
        });
    }
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/slack/commands — /eta slash command.
 */
export async function slackCommandsHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const rawBody = readRawBodyBuffer(req);
    assertSlackSignature(req, rawBody);

    const params = new URLSearchParams(rawBody.toString("utf8"));
    const userId = params.get("user_id") ?? "";
    const text = (params.get("text") ?? "").trim();
    const channelId = params.get("channel_id") ?? "";

    if (!userId) {
      res.status(200).json({
        response_type: "ephemeral",
        text: "Hmm, I couldn't tell who you are in Slack. Mind trying again from your account?"
      });
      return;
    }

    const commandText = text ? `eta ${text}` : "";
    const parsed = parseAttendanceMessage(commandText || "eta");
    if (!parsed || parsed.recordType !== "office" || !parsed.etaText) {
      res.status(200).json({
        response_type: "ephemeral",
        text: "Happy to help — try `/eta 12:30` (or `/eta 1`, `/eta 12 pm`). That'll log your office arrival time for today."
      });
      return;
    }

    try {
      const targetChannel = await resolveChannelId();
      if (channelId && channelId !== targetChannel) {
        // Still allow slash command from anywhere; just note the channel
      }

      const user = await getSlackUserInfo(userId);
      const email = user.profile?.email ?? null;
      const domain = env.attendanceEmailDomain.toLowerCase().replace(/^@/, "");
      if (!email || !email.toLowerCase().endsWith(`@${domain}`)) {
        res.status(200).json({
          response_type: "ephemeral",
          text: `Looks like your Slack email isn't on @${domain} yet — once it is, I can record your attendance from here.`
        });
        return;
      }

      const userName =
        user.profile?.real_name || user.real_name || user.profile?.display_name || user.name || "Unknown";

      await upsertSlackMember({
        slackUserId: user.id,
        name: user.name ?? null,
        email,
        realName: userName,
        isBot: Boolean(user.is_bot),
        isDeleted: Boolean(user.deleted)
      });

      // Use current time as message ts for slash commands
      const messageTs = (Date.now() / 1000).toFixed(6);

      await submitAttendanceFromSlack({
        slackUserId: user.id,
        userEmail: email,
        userName,
        text: commandText,
        messageTs,
        recordType: parsed.recordType,
        etaText: parsed.etaText,
        etaMinutes: parsed.etaMinutes
      });

      res.status(200).json({
        response_type: "ephemeral",
        text: `Got it — office ETA ${parsed.etaText} for today.`
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to record ETA";
      res.status(200).json({
        response_type: "ephemeral",
        text: `Sorry, I couldn't save that ETA (${message}). Mind trying once more?`
      });
    }
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/cron/eta-check — scheduled weekday check (Bearer CRON_SECRET).
 */
export async function etaCronHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const header = req.headers.authorization;
    if (!env.cronSecret) {
      throw new HttpError(500, "CRON_SECRET is not configured");
    }
    if (header !== `Bearer ${env.cronSecret}`) {
      throw new HttpError(401, "Unauthorized cron request");
    }

    const result = await runEtaCheck(todayInIST(), {
      sendReminders: AUTO_REMINDERS_ENABLED,
      missingOnlyReminders: true
    });
    res.status(200).json({
      success: true,
      data: { ...result, autoRemindersEnabled: AUTO_REMINDERS_ENABLED }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/slack/interactions — Block Kit actions (task checklist).
 */
export async function slackInteractionsHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const rawBody = readRawBodyBuffer(req);
    assertSlackSignature(req, rawBody);

    const params = new URLSearchParams(rawBody.toString("utf8"));
    const rawPayload = params.get("payload");
    if (!rawPayload) {
      res.status(400).json({ ok: false, error: "missing_payload" });
      return;
    }

    const payload = JSON.parse(rawPayload) as {
      type?: string;
      user?: { id?: string };
      response_url?: string;
      message?: { blocks?: Array<{ block_id?: string }> };
      actions?: Array<{
        action_id?: string;
        value?: string;
        selected_options?: Array<{ value?: string }>;
      }>;
    };

    res.status(200).json({ ok: true });

    if (payload.type !== "block_actions") return;

    const action = payload.actions?.[0];
    if (!action || action.action_id !== SLACK_WORK_COMPLETE_ACTION) return;

    const checked = Boolean(action.selected_options?.some((option) => option.value));
    const workUnitId = action.selected_options?.[0]?.value ?? "";
    if (!checked || !payload.user?.id || !workUnitId) return;

    void processSlackWorkChecklistAction({
      slackUserId: payload.user.id,
      workUnitId,
      checked,
      responseUrl: payload.response_url,
      messageBlocks: payload.message?.blocks
    }).catch((error) => {
      console.error("Slack work checklist action failed:", error);
    });
  } catch (error) {
    next(error);
  }
}
