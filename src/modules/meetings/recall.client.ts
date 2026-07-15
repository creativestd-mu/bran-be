import { env } from "../../config/env";
import { HttpError } from "../../utils/httpError";

function recallBaseUrl(): string {
  return `https://${env.recallApiRegion}.recall.ai`;
}

function recallHeaders(): Record<string, string> {
  if (!env.recallApiKey) {
    throw new HttpError(500, "RECALL_API_KEY is not configured");
  }

  return {
    Authorization: `Token ${env.recallApiKey}`,
    Accept: "application/json",
    "Content-Type": "application/json"
  };
}

async function recallFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${recallBaseUrl()}${path}`, {
    ...init,
    headers: {
      ...recallHeaders(),
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new HttpError(
      response.status >= 500 ? 502 : response.status,
      `Recall API error (${response.status}): ${body || response.statusText}`
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export interface RecallCalendar {
  id: string;
  platform: string;
  status?: string;
  oauth_email?: string;
}

export interface RecallCalendarEvent {
  id: string;
  calendar_id: string;
  title?: string | null;
  meeting_url?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  is_deleted?: boolean;
  bots?: Array<{ bot_id: string }>;
}

export interface RecallBot {
  id: string;
  meeting_url?: string;
  recordings?: Array<{
    id: string;
    media_shortcuts?: {
      audio_mixed?: { data?: { download_url?: string | null } };
      audio_mixed_mp3?: { data?: { download_url?: string | null } };
    };
  }>;
}

function botConfig() {
  return {
    bot_name: env.meetingBotName,
    metadata: {}
  };
}

export async function createRecallCalendar(params: {
  refreshToken: string;
  oauthEmail?: string;
}): Promise<RecallCalendar> {
  const clientId = env.googleClientIds[0];
  if (!clientId || !env.googleClientSecret) {
    throw new HttpError(500, "Google OAuth client credentials are not configured");
  }

  return recallFetch<RecallCalendar>("/api/v2/calendars/", {
    method: "POST",
    body: JSON.stringify({
      oauth_client_id: clientId,
      oauth_client_secret: env.googleClientSecret,
      oauth_refresh_token: params.refreshToken,
      platform: "google_calendar",
      oauth_email: params.oauthEmail
    })
  });
}

export async function deleteRecallCalendar(recallCalendarId: string): Promise<void> {
  await recallFetch(`/api/v2/calendars/${recallCalendarId}/`, { method: "DELETE" });
}

export async function getRecallCalendar(recallCalendarId: string): Promise<RecallCalendar> {
  return recallFetch<RecallCalendar>(`/api/v2/calendars/${recallCalendarId}/`);
}

export async function listRecallCalendarEvents(params: {
  calendarId: string;
  updatedAtGte?: string;
}): Promise<RecallCalendarEvent[]> {
  const query = new URLSearchParams({ calendar_id: params.calendarId });
  if (params.updatedAtGte) {
    query.set("updated_at__gte", params.updatedAtGte);
  }

  const events: RecallCalendarEvent[] = [];
  let nextUrl: string | null = `/api/v2/calendar-events/?${query.toString()}`;

  while (nextUrl) {
    const page: { results?: RecallCalendarEvent[]; next?: string | null } = await recallFetch(
      nextUrl.startsWith("http") ? nextUrl.replace(recallBaseUrl(), "") : nextUrl
    );
    events.push(...(page.results ?? []));
    nextUrl = page.next ? page.next.replace(recallBaseUrl(), "") : null;
  }

  return events;
}

export async function scheduleBotForCalendarEvent(params: {
  calendarEventId: string;
  meetingUrl: string;
  startTime?: string | null;
}): Promise<string> {
  // One bot per Meet instance across all connected Bran calendars.
  const startKey = params.startTime ?? "unscheduled";
  const deduplicationKey = `${startKey}-${params.meetingUrl}`;

  const response = await recallFetch<RecallCalendarEvent>(
    `/api/v2/calendar-events/${params.calendarEventId}/bot/`,
    {
      method: "POST",
      body: JSON.stringify({
        deduplication_key: deduplicationKey,
        bot_config: botConfig()
      })
    }
  );

  const botId = response.bots?.[0]?.bot_id;
  if (!botId) {
    throw new HttpError(502, "Recall did not return a bot id after scheduling");
  }

  return botId;
}

export async function deleteBotFromCalendarEvent(calendarEventId: string): Promise<void> {
  await recallFetch(`/api/v2/calendar-events/${calendarEventId}/bot/`, { method: "DELETE" });
}

export async function createAdHocBot(params: {
  meetingUrl: string;
  metadata?: Record<string, string>;
  deduplicationKey?: string;
}): Promise<string> {
  const deduplicationKey =
    params.deduplicationKey ?? `adhoc-${params.meetingUrl}-${Date.now()}`;

  const response = await recallFetch<RecallBot>("/api/v1/bot/", {
    method: "POST",
    body: JSON.stringify({
      meeting_url: params.meetingUrl,
      bot_name: env.meetingBotName,
      metadata: {
        ...params.metadata,
        deduplication_key: deduplicationKey
      }
    })
  });

  if (!response.id) {
    throw new HttpError(502, "Recall did not return a bot id for ad-hoc join");
  }

  return response.id;
}

export async function getRecallBot(botId: string): Promise<RecallBot> {
  return recallFetch<RecallBot>(`/api/v1/bot/${botId}/`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractAudioDownloadUrl(bot: RecallBot): string | undefined {
  const recording = bot.recordings?.[0];
  return (
    recording?.media_shortcuts?.audio_mixed_mp3?.data?.download_url ??
    recording?.media_shortcuts?.audio_mixed?.data?.download_url ??
    undefined
  );
}

/**
 * On `bot.done`, Recall has finished the call but the mixed-audio artifact is
 * often still being processed for a short while, so the download_url isn't
 * populated yet. Poll the bot until the audio is ready before giving up.
 */
export async function downloadRecallBotAudio(
  botId: string,
  options: { maxAttempts?: number; delayMs?: number } = {}
): Promise<{
  buffer: Buffer;
  mimeType: string;
  filename: string;
}> {
  const maxAttempts = options.maxAttempts ?? 20;
  const delayMs = options.delayMs ?? 15_000;

  let downloadUrl: string | undefined;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const bot = await getRecallBot(botId);
    downloadUrl = extractAudioDownloadUrl(bot);
    if (downloadUrl) {
      break;
    }
    if (attempt < maxAttempts) {
      await sleep(delayMs);
    }
  }

  if (!downloadUrl) {
    throw new HttpError(422, "Recall bot recording audio is not available yet");
  }

  const response = await fetch(downloadUrl);
  if (!response.ok) {
    throw new HttpError(502, `Failed to download Recall recording (${response.status})`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const contentType = response.headers.get("content-type") ?? "audio/mpeg";

  return {
    buffer: Buffer.from(arrayBuffer),
    mimeType: contentType,
    filename: `meeting-${botId}.mp3`
  };
}
