import type { Request, Response } from "express";

import { env } from "../../config/env";
import { prisma } from "../../lib/prisma";
import { HttpError } from "../../utils/httpError";
import { createWorkUnitsFromRecording } from "../work/work.service";
import { archiveVoiceRecording } from "../voice-recording/voice-recording.service";
import { translateAudioWithSarvam } from "../ai/ai.sarvam";
import { updateVoiceRecording } from "../voice-recording/voice-recording.repository";
import { invalidateBrainGraphCache } from "../graph/graph.service";
import {
  buildCalendarAuthorizationUrl,
  buildCalendarOAuthState,
  exchangeCalendarAuthCode,
  verifyCalendarOAuthState
} from "./google-oauth.client";
import { isGoogleMeetUrl } from "./meetings.constants";
import {
  createMeeting,
  findCalendarConnectionByRecallId,
  findCalendarConnectionByUserId,
  findMeetingById,
  findMeetingByCalendarEventId,
  findMeetingByRecallBotId,
  listConnectedCalendarConnections,
  listMeetingsForUser,
  updateCalendarConnection,
  updateMeeting,
  upsertCalendarConnection
} from "./meetings.repository";
import {
  createAdHocBot,
  createRecallCalendar,
  deleteRecallCalendar,
  downloadRecallBotAudio,
  getRecallCalendar,
  listRecallCalendarEvents,
  scheduleBotForCalendarEvent
} from "./recall.client";

function redirectToApp(path: string, res: Response): void {
  const base = env.appUrl || "http://localhost:3000";
  res.redirect(`${base.replace(/\/$/, "")}${path}`);
}

export async function startCalendarConnect(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.isActive) {
    throw new HttpError(403, "Account is deactivated");
  }

  const state = buildCalendarOAuthState(userId);
  return {
    authorizationUrl: buildCalendarAuthorizationUrl(state)
  };
}

export async function handleCalendarOAuthCallback(req: Request, res: Response): Promise<void> {
  try {
    const code = typeof req.query.code === "string" ? req.query.code : null;
    const state = typeof req.query.state === "string" ? req.query.state : null;
    const oauthError = typeof req.query.error === "string" ? req.query.error : null;

    if (oauthError) {
      redirectToApp(`/meetings?calendar=error&message=${encodeURIComponent(oauthError)}`, res);
      return;
    }

    if (!code || !state) {
      redirectToApp("/meetings?calendar=error&message=missing_oauth_params", res);
      return;
    }

    const userId = verifyCalendarOAuthState(state);
    const { refreshToken, email } = await exchangeCalendarAuthCode(code);

    const existing = await findCalendarConnectionByUserId(userId);
    if (existing?.recallCalendarId) {
      try {
        await deleteRecallCalendar(existing.recallCalendarId);
      } catch {
        // Best-effort cleanup before reconnecting.
      }
    }

    const recallCalendar = await createRecallCalendar({
      refreshToken,
      oauthEmail: email
    });

    await upsertCalendarConnection({
      userId,
      recallCalendarId: recallCalendar.id,
      oauthEmail: email ?? recallCalendar.oauth_email ?? null,
      status: "CONNECTED"
    });

    // Recall pulls events from Google asynchronously after the calendar is
    // created, so an immediate sync usually finds nothing. Retry a few times
    // (and the periodic cron + calendar.sync_events webhook are the safety net).
    scheduleInitialCalendarSync(recallCalendar.id);

    redirectToApp("/meetings?calendar=connected", res);
  } catch (error) {
    const message = error instanceof Error ? error.message : "calendar_connect_failed";
    redirectToApp(`/meetings?calendar=error&message=${encodeURIComponent(message)}`, res);
  }
}

export async function getCalendarStatus(userId: string) {
  const connection = await findCalendarConnectionByUserId(userId);
  if (!connection) {
    return { connected: false };
  }

  return {
    connected: connection.status === "CONNECTED",
    status: connection.status,
    oauthEmail: connection.oauthEmail,
    connectedAt: connection.connectedAt
  };
}

export async function disconnectCalendar(userId: string) {
  const connection = await findCalendarConnectionByUserId(userId);
  if (!connection) {
    throw new HttpError(404, "No calendar connection found");
  }

  try {
    await deleteRecallCalendar(connection.recallCalendarId);
  } catch {
    // Continue local disconnect even if Recall delete fails.
  }

  await updateCalendarConnection(userId, {
    status: "DISCONNECTED",
    disconnectedAt: new Date()
  });

  return { disconnected: true };
}

export async function listMeetings(userId: string, options?: { status?: string; limit?: number }) {
  const meetings = await listMeetingsForUser(userId, options);
  return meetings.map(formatMeetingResponse);
}

export async function joinMeetingManually(
  userId: string,
  data: { meetingUrl: string; title?: string }
) {
  if (!isGoogleMeetUrl(data.meetingUrl)) {
    throw new HttpError(400, "Only Google Meet URLs are supported");
  }

  const meeting = await createMeeting({
    organizerUserId: userId,
    meetingUrl: data.meetingUrl,
    title: data.title ?? null,
    status: "JOINING"
  });

  const recallBotId = await createAdHocBot({
    meetingUrl: data.meetingUrl,
    deduplicationKey: `adhoc-${data.meetingUrl}`,
    metadata: {
      branMeetingId: meeting.id,
      branUserId: userId
    }
  });

  const updated = await updateMeeting(meeting.id, { recallBotId });
  return formatMeetingResponse(updated);
}

function formatMeetingResponse(meeting: {
  id: string;
  organizerUserId: string;
  recallBotId: string | null;
  calendarEventId: string | null;
  meetingUrl: string;
  title: string | null;
  startTime: Date | null;
  status: string;
  voiceRecordingId: string | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
  voiceRecording?: {
    id: string;
    transcript: string | null;
    status: string;
  } | null;
}) {
  return {
    id: meeting.id,
    organizerUserId: meeting.organizerUserId,
    recallBotId: meeting.recallBotId,
    calendarEventId: meeting.calendarEventId,
    meetingUrl: meeting.meetingUrl,
    title: meeting.title,
    startTime: meeting.startTime,
    status: meeting.status,
    voiceRecordingId: meeting.voiceRecordingId,
    errorMessage: meeting.errorMessage,
    createdAt: meeting.createdAt,
    updatedAt: meeting.updatedAt,
    voiceRecording: meeting.voiceRecording ?? null
  };
}

export async function handleRecallWebhookEvent(payload: {
  event?: string;
  data?: Record<string, unknown>;
}) {
  const event = payload.event;
  const data = payload.data ?? {};

  if (event === "calendar.sync_events") {
    const calendarId = typeof data.calendar_id === "string" ? data.calendar_id : null;
    const lastUpdatedTs =
      typeof data.last_updated_ts === "string" ? data.last_updated_ts : undefined;
    if (calendarId) {
      await syncCalendarEvents(calendarId, lastUpdatedTs);
    }
    return;
  }

  if (event === "calendar.update") {
    const calendarId = typeof data.calendar_id === "string" ? data.calendar_id : null;
    if (calendarId) {
      await handleCalendarUpdate(calendarId);
    }
    return;
  }

  if (event === "bot.status_change") {
    const botId = extractRecallBotId(data);
    const status = data.status as { code?: string } | undefined;
    if (botId && status?.code) {
      await handleBotStatusChange(botId, status.code);
    }
    return;
  }

  if (event?.startsWith("bot.")) {
    const botId = extractRecallBotId(data);
    if (!botId) return;

    const statusCode = event.slice("bot.".length);
    if (statusCode === "done") {
      await handleBotDone(botId);
      return;
    }

    if (
      statusCode === "joining_call" ||
      statusCode === "in_waiting_room" ||
      statusCode === "in_call_recording" ||
      statusCode === "call_ended" ||
      statusCode === "fatal"
    ) {
      await handleBotStatusChange(botId, statusCode);
    }
  }
}

function extractRecallBotId(data: Record<string, unknown>): string | null {
  const bot = data.bot as { id?: string } | undefined;
  if (bot?.id) return bot.id;
  if (typeof data.bot_id === "string") return data.bot_id;
  return null;
}

async function handleCalendarUpdate(recallCalendarId: string) {
  const connection = await findCalendarConnectionByRecallId(recallCalendarId);
  if (!connection) return;

  try {
    const recallCalendar = await getRecallCalendar(recallCalendarId);
    if (recallCalendar.status === "disconnected") {
      await updateCalendarConnection(connection.userId, {
        status: "DISCONNECTED",
        disconnectedAt: new Date()
      });
    }
  } catch {
    await updateCalendarConnection(connection.userId, {
      status: "ERROR"
    });
  }
}

export async function syncCalendarEvents(recallCalendarId: string, updatedAtGte?: string) {
  const connection = await findCalendarConnectionByRecallId(recallCalendarId);
  if (!connection || connection.status !== "CONNECTED") {
    return;
  }

  const events = await listRecallCalendarEvents({
    calendarId: recallCalendarId,
    updatedAtGte
  });

  const now = Date.now();

  for (const event of events) {
    if (event.is_deleted) {
      const existing = await findMeetingByCalendarEventId(event.id);
      if (existing && existing.status !== "CANCELLED") {
        await updateMeeting(existing.id, { status: "CANCELLED" });
      }
      continue;
    }

    if (!isGoogleMeetUrl(event.meeting_url)) {
      continue;
    }

    // Skip meetings that already ended (with a small grace window).
    if (event.start_time) {
      const startMs = new Date(event.start_time).getTime();
      if (!Number.isNaN(startMs) && startMs < now - 2 * 60 * 60 * 1000) {
        continue;
      }
    }

    let meeting = await findMeetingByCalendarEventId(event.id);

    // Once a bot has started joining/recording (or the meeting is done), leave
    // it alone — re-syncing must never knock an in-flight meeting back to
    // SCHEDULED or swap its bot, which would break the recording pipeline.
    if (meeting && meeting.status !== "SCHEDULED" && meeting.status !== "CANCELLED") {
      continue;
    }

    // Compare start times by epoch, not raw string, so formatting differences
    // (e.g. trailing ".000Z") don't register as a spurious reschedule.
    const previousStartMs = meeting?.startTime ? meeting.startTime.getTime() : null;
    const nextStartMs = event.start_time ? new Date(event.start_time).getTime() : null;
    const startChanged = Boolean(meeting?.recallBotId && previousStartMs !== nextStartMs);

    if (!meeting) {
      meeting = await createMeeting({
        organizerUserId: connection.userId,
        calendarEventId: event.id,
        meetingUrl: event.meeting_url!,
        title: event.title ?? null,
        startTime: event.start_time ? new Date(event.start_time) : null,
        status: "SCHEDULED"
      });
    } else {
      meeting = await updateMeeting(meeting.id, {
        title: event.title ?? meeting.title,
        startTime: event.start_time ? new Date(event.start_time) : meeting.startTime,
        meetingUrl: event.meeting_url ?? meeting.meetingUrl,
        status: "SCHEDULED"
      });
    }

    // Already scheduled and time unchanged — keep existing bot.
    if (meeting.recallBotId && !startChanged) {
      continue;
    }

    try {
      const recallBotId = await scheduleBotForCalendarEvent({
        calendarEventId: event.id,
        meetingUrl: event.meeting_url!,
        startTime: event.start_time
      });
      await updateMeeting(meeting.id, {
        recallBotId,
        status: "SCHEDULED",
        errorMessage: null
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to schedule meeting bot";
      await updateMeeting(meeting.id, { status: "FAILED", errorMessage: message });
    }
  }
}

/** Force-sync upcoming Meet events for the viewer's connected calendar and schedule bots. */
export async function syncMyCalendar(userId: string) {
  const connection = await findCalendarConnectionByUserId(userId);
  if (!connection || connection.status !== "CONNECTED") {
    throw new HttpError(400, "Connect Google Calendar first to auto-join Meet calls");
  }

  await syncCalendarEvents(connection.recallCalendarId);
  const meetings = await listMeetingsForUser(userId, { limit: 50 });
  return {
    synced: true,
    meetings: meetings.map(formatMeetingResponse)
  };
}

/**
 * Re-run processing for a meeting that previously failed (e.g. the recording
 * wasn't ready yet at bot.done). Runs in the background because downloading the
 * recording can poll Recall for several minutes.
 */
export async function retryMeetingProcessing(userId: string, meetingId: string) {
  const meeting = await findMeetingById(meetingId);
  if (!meeting || meeting.organizerUserId !== userId) {
    throw new HttpError(404, "Meeting not found");
  }
  if (!meeting.recallBotId) {
    throw new HttpError(
      400,
      "This meeting has no recording bot yet, so there is nothing to reprocess"
    );
  }
  if (meeting.status === "PROCESSING") {
    throw new HttpError(409, "This meeting is already being processed");
  }

  const botId = meeting.recallBotId;
  await updateMeeting(meeting.id, { status: "PROCESSING", errorMessage: null });
  void processMeetingRecording(botId).catch(async (error) => {
    const message = error instanceof Error ? error.message : "Meeting processing failed";
    const current = await findMeetingByRecallBotId(botId);
    if (current) {
      await updateMeeting(current.id, { status: "FAILED", errorMessage: message });
    }
    console.error(`[meetings] Retry processing failed for bot ${botId}:`, error);
  });

  const refreshed = await findMeetingById(meeting.id);
  return formatMeetingResponse(refreshed ?? meeting);
}

/**
 * Retry the initial sync a few times after a calendar is connected, because
 * Recall imports Google events asynchronously and the first attempt usually
 * runs before any events are available.
 */
function scheduleInitialCalendarSync(recallCalendarId: string): void {
  const delaysMs = [0, 15_000, 45_000, 120_000];
  for (const delay of delaysMs) {
    const timer = setTimeout(() => {
      void syncCalendarEvents(recallCalendarId).catch((error) => {
        console.error(
          `[meetings] Initial calendar sync failed for ${recallCalendarId}:`,
          error
        );
      });
    }, delay);
    if (typeof timer === "object" && timer && "unref" in timer) {
      timer.unref();
    }
  }
}

/**
 * Safety-net re-sync over every connected calendar so bots get scheduled for
 * all upcoming Meet calls even if a Recall webhook was missed. Invoked by the
 * meetings cron on a fixed interval.
 */
export async function syncAllConnectedCalendars(): Promise<{
  calendars: number;
  failures: number;
}> {
  const connections = await listConnectedCalendarConnections();
  let failures = 0;

  for (const connection of connections) {
    try {
      await syncCalendarEvents(connection.recallCalendarId);
    } catch (error) {
      failures += 1;
      console.error(
        `[meetings] Cron sync failed for calendar ${connection.recallCalendarId}:`,
        error
      );
    }
  }

  return { calendars: connections.length, failures };
}

async function handleBotStatusChange(botId: string, statusCode: string) {
  const meeting = await findMeetingByRecallBotId(botId);
  if (!meeting) return;

  if (statusCode === "joining_call" || statusCode === "in_waiting_room") {
    await updateMeeting(meeting.id, { status: "JOINING" });
    return;
  }

  if (statusCode === "in_call_recording") {
    await updateMeeting(meeting.id, { status: "RECORDING" });
    return;
  }

  if (statusCode === "done") {
    await handleBotDone(botId);
    return;
  }

  if (statusCode === "fatal") {
    await updateMeeting(meeting.id, {
      status: "FAILED",
      errorMessage: "Recall bot failed to complete the meeting"
    });
  }
}

async function handleBotDone(botId: string) {
  const meeting = await findMeetingByRecallBotId(botId);
  if (!meeting || meeting.status === "COMPLETED" || meeting.status === "PROCESSING") {
    return;
  }

  await updateMeeting(meeting.id, { status: "PROCESSING", errorMessage: null });
  void processMeetingRecording(botId).catch(async (error) => {
    const message = error instanceof Error ? error.message : "Meeting processing failed";
    const current = await findMeetingByRecallBotId(botId);
    if (current) {
      await updateMeeting(current.id, { status: "FAILED", errorMessage: message });
    }
    console.error(`Meeting processing failed for bot ${botId}:`, error);
  });
}

export async function processMeetingRecording(recallBotId: string) {
  const meeting = await findMeetingByRecallBotId(recallBotId);
  if (!meeting) {
    throw new HttpError(404, "Meeting not found for Recall bot");
  }

  const audio = await downloadRecallBotAudio(recallBotId);
  const recording = await archiveVoiceRecording({
    userId: meeting.organizerUserId,
    source: "meeting",
    fileBuffer: audio.buffer,
    originalname: audio.filename,
    mimetype: audio.mimeType,
    status: "COMPLETED"
  });

  try {
    const sarvam = await translateAudioWithSarvam({
      fileBuffer: audio.buffer,
      originalname: audio.filename,
      mimetype: audio.mimeType,
      prompt: "Meeting transcript with speaker names when available."
    });

    const updatedRecording = await updateVoiceRecording(recording.id, {
      transcript: sarvam.transcript,
      sarvamRequestId: sarvam.requestId,
      languageCode: sarvam.languageCode,
      languageProbability: sarvam.languageProbability,
      status: "COMPLETED",
      errorMessage: null
    });

    await createWorkUnitsFromRecording(meeting.organizerUserId, updatedRecording, sarvam.transcript);

    await updateMeeting(meeting.id, {
      voiceRecordingId: updatedRecording.id,
      status: "COMPLETED",
      errorMessage: null
    });

    invalidateBrainGraphCache(meeting.organizerUserId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Transcription failed";
    await updateVoiceRecording(recording.id, {
      status: "FAILED",
      errorMessage: message
    });
    throw error;
  }
}
