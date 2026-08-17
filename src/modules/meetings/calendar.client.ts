import { randomUUID } from "crypto";
import { google } from "googleapis";

import { env } from "../../config/env";
import { HttpError } from "../../utils/httpError";
import { createCalendarOAuthClient } from "./google-oauth.client";

export type BusyInterval = { start: Date; end: Date };

export type CalendarDayEvent = {
  id: string;
  title: string;
  start: Date | null;
  end: Date | null;
  meetLink: string | null;
  htmlLink: string | null;
  isAllDay: boolean;
};

function getCalendarApi(refreshToken: string) {
  const auth = createCalendarOAuthClient(refreshToken);
  return google.calendar({ version: "v3", auth });
}

export async function queryCalendarFreeBusy(input: {
  refreshToken: string;
  calendarIds: string[];
  timeMin: Date;
  timeMax: Date;
}): Promise<BusyInterval[]> {
  const calendar = getCalendarApi(input.refreshToken);
  const response = await calendar.freebusy.query({
    requestBody: {
      timeMin: input.timeMin.toISOString(),
      timeMax: input.timeMax.toISOString(),
      timeZone: env.appTimezone,
      items: input.calendarIds.map((id) => ({ id }))
    }
  });

  const busy: BusyInterval[] = [];
  const calendars = response.data.calendars ?? {};
  for (const cal of Object.values(calendars)) {
    for (const block of cal.busy ?? []) {
      if (!block.start || !block.end) continue;
      const start = new Date(block.start);
      const end = new Date(block.end);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;
      if (end <= start) continue;
      busy.push({ start, end });
    }
  }
  return busy;
}

export async function listPrimaryCalendarEvents(input: {
  refreshToken: string;
  timeMin: Date;
  timeMax: Date;
}): Promise<CalendarDayEvent[]> {
  const calendar = getCalendarApi(input.refreshToken);
  const response = await calendar.events.list({
    calendarId: "primary",
    timeMin: input.timeMin.toISOString(),
    timeMax: input.timeMax.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 50
  });

  return (response.data.items ?? []).map((event) => {
    const isAllDay = Boolean(event.start?.date && !event.start?.dateTime);
    const startRaw = event.start?.dateTime ?? event.start?.date ?? null;
    const endRaw = event.end?.dateTime ?? event.end?.date ?? null;
    const meetLink =
      event.hangoutLink ??
      event.conferenceData?.entryPoints?.find((entry) => entry.entryPointType === "video")?.uri ??
      null;

    return {
      id: event.id ?? randomUUID(),
      title: event.summary?.trim() || "(No title)",
      start: startRaw ? new Date(startRaw) : null,
      end: endRaw ? new Date(endRaw) : null,
      meetLink,
      htmlLink: event.htmlLink ?? null,
      isAllDay
    };
  });
}

export async function createMeetCalendarEvent(input: {
  refreshToken: string;
  summary: string;
  description?: string | null;
  start: Date;
  end: Date;
  attendeeEmails: string[];
}): Promise<{
  eventId: string;
  htmlLink: string | null;
  meetLink: string | null;
  summary: string;
}> {
  const calendar = getCalendarApi(input.refreshToken);
  const requestId = randomUUID();

  try {
    const response = await calendar.events.insert({
      calendarId: "primary",
      conferenceDataVersion: 1,
      sendUpdates: "all",
      requestBody: {
        summary: input.summary,
        description: input.description ?? undefined,
        start: {
          dateTime: input.start.toISOString(),
          timeZone: env.appTimezone
        },
        end: {
          dateTime: input.end.toISOString(),
          timeZone: env.appTimezone
        },
        attendees: input.attendeeEmails.map((email) => ({ email })),
        conferenceData: {
          createRequest: {
            requestId,
            conferenceSolutionKey: { type: "hangoutsMeet" }
          }
        }
      }
    });

    const event = response.data;
    const meetLink =
      event.hangoutLink ??
      event.conferenceData?.entryPoints?.find((entry) => entry.entryPointType === "video")?.uri ??
      null;

    if (!event.id) {
      throw new HttpError(502, "Google Calendar did not return an event id");
    }

    return {
      eventId: event.id,
      htmlLink: event.htmlLink ?? null,
      meetLink,
      summary: event.summary ?? input.summary
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create calendar event";
    throw new HttpError(502, `Could not create Google Meet event: ${message}`);
  }
}
