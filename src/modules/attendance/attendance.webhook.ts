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

function readRawBody(req: Request): string {
  if (req.body instanceof Buffer) {
    return req.body.toString("utf8");
  }
  if (typeof req.body === "string") {
    return req.body;
  }
  return JSON.stringify(req.body ?? {});
}

function assertSlackSignature(req: Request, rawBody: string): void {
  if (!env.slackSigningSecret) {
    throw new HttpError(500, "SLACK_SIGNING_SECRET is not configured");
  }

  const valid = verifySlackSignature({
    signingSecret: env.slackSigningSecret,
    signature: req.header("x-slack-signature") ?? undefined,
    timestamp: req.header("x-slack-request-timestamp") ?? undefined,
    rawBody
  });

  if (!valid) {
    throw new HttpError(401, "Invalid Slack signature");
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
    const rawBody = readRawBody(req);

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
          url_private?: string;
          url_private_download?: string;
          permalink?: string;
          thumb_360?: string;
        }>;
      };
    };

    try {
      payload = JSON.parse(rawBody) as typeof payload;
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
    if (!event || event.type !== "message") {
      return;
    }

    if (!event.channel || !event.user || !event.ts) {
      return;
    }

    const hasText = Boolean(event.text?.trim());
    const hasFiles = Boolean(event.files?.length);

    if (hasText) {
      void processSlackChannelMessage({
        channelId: event.channel,
        userId: event.user,
        text: event.text!,
        ts: event.ts,
        botId: event.bot_id,
        subtype: event.subtype,
        threadTs: event.thread_ts,
        channelType: event.channel_type
      }).catch((error) => {
        console.error("Slack attendance event processing failed:", error);
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
    const rawBody = readRawBody(req);
    assertSlackSignature(req, rawBody);

    const params = new URLSearchParams(rawBody);
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
