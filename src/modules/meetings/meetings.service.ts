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
  findMeetingByCalendarEventId,
  findMeetingByRecallBotId,
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

    let meeting = await findMeetingByCalendarEventId(event.id);
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
        meetingUrl: event.meeting_url ?? meeting.meetingUrl
      });
    }

    if (meeting.recallBotId) {
      continue;
    }

    try {
      const recallBotId = await scheduleBotForCalendarEvent({
        calendarEventId: event.id,
        meetingUrl: event.meeting_url!,
        startTime: event.start_time
      });
      await updateMeeting(meeting.id, { recallBotId, status: "SCHEDULED" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to schedule meeting bot";
      await updateMeeting(meeting.id, { status: "FAILED", errorMessage: message });
    }
  }
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
