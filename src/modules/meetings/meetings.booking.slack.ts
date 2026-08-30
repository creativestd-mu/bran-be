import jwt from "jsonwebtoken";

import { env } from "../../config/env";
import { prisma } from "../../lib/prisma";
import { endOfDayInTimezone, startOfDayInTimezone } from "../../utils/timezone";
import {
  getSlackBotUserId,
  postSlackMessage,
  respondToSlackResponseUrl
} from "../attendance/attendance.slack";
import { decryptSecret } from "../gmail/gmail.crypto";
import {
  findNameCandidates,
  loadNameAssignmentPreferences,
  normalizeNameKey
} from "../work/work.name-preference";
import { resolveBranUserIdForSlackUser } from "../work/work.slack";
import {
  collectSlackUserMentions,
  stripSlackUserMentions,
  textMentionsSlackUser
} from "../work/work.slack-tasks";
import { isSlackDmChannel } from "../work/work.slack-voice";
import {
  hasExplicitTaskCreateEnvelope,
  hasTopLevelBookCallInstruction,
  stripQuotedSlackLines
} from "../slack-intents/slack-intents.text";
import {
  createMeetCalendarEvent,
  listPrimaryCalendarEvents,
  queryCalendarFreeBusy,
  type BusyInterval
} from "./calendar.client";
import {
  deriveMeetingTitle,
  formatSlotLabel,
  generateBookingCandidateSlots,
  pickFreeBookingSlots,
  type BookingSlot
} from "./meetings.booking";
import { findCalendarConnectionByUserId } from "./meetings.repository";

export const SLACK_CALENDAR_BOOK_SLOT_ACTION = "bran_calendar_book_slot";
export const SLACK_CALENDAR_PICK_PERSON_ACTION = "bran_calendar_pick_person";

const AGENDA_RE =
  /\b((what(?:'s| is)|show|list|get|fetch)\s+(my\s+)?(calendar|meetings|calls|schedule)|my\s+(calendar|meetings|calls|schedule)(\s+for\s+today)?|meetings?\s+(for\s+)?today|calendar\s+(for\s+)?today|what(?:'s| is)\s+on\s+my\s+calendar)\b/i;

const BOOKING_DEDUP_TTL_MS = 60 * 1000;
const recentBookingEvents = new Map<string, number>();

const SLOT_TOKEN_PURPOSE = "bran_cal_book_slot";
const PERSON_TOKEN_PURPOSE = "bran_cal_pick_person";

type SlotTokenPayload = {
  purpose: typeof SLOT_TOKEN_PURPOSE;
  requesterUserId: string;
  targetUserId: string;
  startIso: string;
  endIso: string;
  title: string;
};

type PersonTokenPayload = {
  purpose: typeof PERSON_TOKEN_PURPOSE;
  requesterUserId: string;
  targetUserId: string;
  sourceText: string;
};

function markBookingEvent(channelId: string, ts: string): boolean {
  const now = Date.now();
  for (const [key, seenAt] of recentBookingEvents) {
    if (now - seenAt > BOOKING_DEDUP_TTL_MS) recentBookingEvents.delete(key);
  }
  const key = `${channelId}:${ts}`;
  if (recentBookingEvents.has(key)) return false;
  recentBookingEvents.set(key, now);
  return true;
}

export function looksLikeBookCallQuery(text: string): boolean {
  const cleaned = stripQuotedSlackLines(text);
  // Task dumps ("Add tasks: … set up a call with …") must not become bookings.
  if (hasExplicitTaskCreateEnvelope(cleaned)) return false;
  return hasTopLevelBookCallInstruction(cleaned);
}

export function looksLikeCalendarAgendaQuery(text: string): boolean {
  const cleaned = stripQuotedSlackLines(text);
  if (hasExplicitTaskCreateEnvelope(cleaned)) return false;
  return AGENDA_RE.test(stripSlackUserMentions(cleaned));
}

export function looksLikeCalendarQuery(text: string): boolean {
  return looksLikeBookCallQuery(text) || looksLikeCalendarAgendaQuery(text);
}

function meetingsAppUrl(): string {
  const base = env.appUrl.replace(/\/$/, "");
  return base ? `${base}/meetings` : "/meetings";
}

function signToken(payload: object): string {
  if (!env.jwtSecret) {
    throw new Error("JWT_SECRET is required for calendar booking actions");
  }
  return jwt.sign(payload, env.jwtSecret, { expiresIn: "30m" });
}

function verifyToken<T extends object>(token: string, purpose: string): T | null {
  if (!env.jwtSecret) return null;
  try {
    const payload = jwt.verify(token, env.jwtSecret) as T & { purpose?: string };
    if (payload.purpose !== purpose) return null;
    return payload;
  } catch {
    return null;
  }
}

async function loadDecryptedCalendarToken(userId: string): Promise<{
  refreshToken: string;
  oauthEmail: string | null;
} | null> {
  const connection = await findCalendarConnectionByUserId(userId);
  if (!connection || connection.status !== "CONNECTED" || !connection.refreshToken) {
    return null;
  }
  try {
    return {
      refreshToken: decryptSecret(connection.refreshToken),
      oauthEmail: connection.oauthEmail
    };
  } catch {
    return null;
  }
}

async function assertRequesterBookingReady(userId: string): Promise<
  | { ok: true; refreshToken: string; oauthEmail: string | null }
  | { ok: false; message: string }
> {
  const calendar = await loadDecryptedCalendarToken(userId);
  if (!calendar) {
    return {
      ok: false,
      message: [
        "Connect (or *reconnect*) *Google Calendar* in Bran to book calls.",
        "We need write + freebusy access — reconnect even if Calendar already looks connected:",
        meetingsAppUrl()
      ].join("\n")
    };
  }
  return { ok: true, refreshToken: calendar.refreshToken, oauthEmail: calendar.oauthEmail };
}

function extractBookedPersonName(text: string): string | null {
  const cleaned = stripSlackUserMentions(text);
  const withMatch = cleaned.match(
    /\bwith\s+([A-Za-z][A-Za-z.'\-]*(?:\s+[A-Za-z][A-Za-z.'\-]*){0,2})/i
  );
  if (withMatch?.[1]) return withMatch[1].trim();
  return null;
}

async function resolveBookingTarget(input: {
  text: string;
  requesterUserId: string;
  requesterSlackId: string;
}): Promise<
  | { kind: "resolved"; user: { id: string; name: string; email: string } }
  | { kind: "ambiguous"; users: Array<{ id: string; name: string; email: string }> }
  | { kind: "missing"; message: string }
> {
  const botUserId = await getSlackBotUserId();
  const mentions = collectSlackUserMentions(input.text).filter((id) => {
    if (botUserId && id.toUpperCase() === botUserId.toUpperCase()) return false;
    return id.toUpperCase() !== input.requesterSlackId.toUpperCase();
  });

  if (mentions.length === 1) {
    const branUserId = await resolveBranUserIdForSlackUser(mentions[0]);
    if (!branUserId) {
      return {
        kind: "missing",
        message: "I couldn’t match that Slack mention to an active Bran user."
      };
    }
    const user = await prisma.user.findFirst({
      where: { id: branUserId, isActive: true },
      select: { id: true, name: true, email: true }
    });
    if (!user) {
      return { kind: "missing", message: "That teammate isn’t an active Bran user." };
    }
    return { kind: "resolved", user };
  }

  const spoken = extractBookedPersonName(input.text);
  if (!spoken) {
    return {
      kind: "missing",
      message:
        "Who should I book with? Try `@Bran book a call with @Name` or `book a call with Dhananjay`."
    };
  }

  const users = await prisma.user.findMany({
    where: { isActive: true, isPlaceholder: false, id: { not: input.requesterUserId } },
    select: { id: true, name: true, email: true }
  });
  const preferenceMap = await loadNameAssignmentPreferences(input.requesterUserId);
  const preferred = preferenceMap.get(normalizeNameKey(spoken));
  if (preferred) {
    const match = users.find((user) => user.id === preferred);
    if (match) return { kind: "resolved", user: match };
  }

  const candidates = findNameCandidates(normalizeNameKey(spoken), users);
  if (candidates.length === 0) {
    return {
      kind: "missing",
      message: `I couldn’t find *${spoken}* in Bran. Try an @mention.`
    };
  }
  if (candidates.length === 1) {
    const user = users.find((row) => row.id === candidates[0].id)!;
    return { kind: "resolved", user };
  }

  return {
    kind: "ambiguous",
    users: candidates
      .map((candidate) => users.find((row) => row.id === candidate.id)!)
      .filter(Boolean)
      .slice(0, 5)
  };
}

async function collectBusyForPair(input: {
  requesterRefreshToken: string;
  targetUserId: string;
  timeMin: Date;
  timeMax: Date;
}): Promise<BusyInterval[]> {
  const busyLists: BusyInterval[][] = [];

  busyLists.push(
    await queryCalendarFreeBusy({
      refreshToken: input.requesterRefreshToken,
      calendarIds: ["primary"],
      timeMin: input.timeMin,
      timeMax: input.timeMax
    })
  );

  const targetCal = await loadDecryptedCalendarToken(input.targetUserId);
  if (targetCal) {
    try {
      // Prefer querying the target's own calendar with their token.
      busyLists.push(
        await queryCalendarFreeBusy({
          refreshToken: targetCal.refreshToken,
          calendarIds: ["primary"],
          timeMin: input.timeMin,
          timeMax: input.timeMax
        })
      );
    } catch (error) {
      console.warn("[calendar.booking] target freebusy failed:", error);
      // Fall back: ask Google using the requester token + target email (works if shared).
      if (targetCal.oauthEmail) {
        try {
          busyLists.push(
            await queryCalendarFreeBusy({
              refreshToken: input.requesterRefreshToken,
              calendarIds: [targetCal.oauthEmail],
              timeMin: input.timeMin,
              timeMax: input.timeMax
            })
          );
        } catch (fallbackError) {
          console.warn("[calendar.booking] target email freebusy failed:", fallbackError);
        }
      }
    }
  }

  return busyLists.flat();
}

function buildSlotBlocks(input: {
  targetName: string;
  title: string;
  slots: BookingSlot[];
  tokens: string[];
}): unknown[] {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `Here are open slots with *${input.targetName}* (12:00–19:00 IST).\nProposed title: *${input.title}*\nPick one:`
      }
    },
    {
      type: "actions",
      block_id: "bran_calendar_slots",
      elements: input.slots.map((slot, index) => ({
        type: "button",
        // Slack requires unique action_ids within the same actions block.
        action_id: `${SLACK_CALENDAR_BOOK_SLOT_ACTION}_${index}`,
        text: { type: "plain_text", text: slot.label.slice(0, 75), emoji: false },
        value: input.tokens[index]
      }))
    }
  ];
}

async function offerSlotsForTarget(input: {
  channelId: string;
  threadTs?: string;
  ts: string;
  requesterUserId: string;
  requesterName: string;
  requesterRefreshToken: string;
  target: { id: string; name: string; email: string };
  sourceText: string;
}): Promise<{ handled: true; reason: string }> {
  const title = deriveMeetingTitle({
    text: input.sourceText,
    requesterName: input.requesterName,
    targetName: input.target.name
  });

  const candidates = generateBookingCandidateSlots();
  if (candidates.length === 0) {
    await postSlackMessage(
      input.channelId,
      "I couldn’t find any weekday slots between 12:00–19:00 IST in the next week.",
      { threadTs: input.threadTs ?? input.ts }
    );
    return { handled: true, reason: "no_candidates" };
  }

  const timeMin = candidates[0].start;
  const timeMax = candidates[candidates.length - 1].end;
  let busy: BusyInterval[] = [];
  try {
    busy = await collectBusyForPair({
      requesterRefreshToken: input.requesterRefreshToken,
      targetUserId: input.target.id,
      timeMin,
      timeMax
    });
  } catch (error) {
    console.error("[calendar.booking] freebusy failed:", error);
    await postSlackMessage(
      input.channelId,
      [
        "I couldn’t check calendars right now.",
        "Reconnect *Google Calendar* in Bran (so freebusy + event create scopes are granted), then try again:",
        meetingsAppUrl()
      ].join("\n"),
      { threadTs: input.threadTs ?? input.ts }
    );
    return { handled: true, reason: "freebusy_failed" };
  }

  const free = pickFreeBookingSlots(candidates, busy);
  if (free.length === 0) {
    await postSlackMessage(
      input.channelId,
      `I couldn’t find a free slot with *${input.target.name}* between 12:00–19:00 IST over the next week.`,
      { threadTs: input.threadTs ?? input.ts }
    );
    return { handled: true, reason: "no_free_slots" };
  }

  const tokens = free.map((slot) =>
    signToken({
      purpose: SLOT_TOKEN_PURPOSE,
      requesterUserId: input.requesterUserId,
      targetUserId: input.target.id,
      startIso: slot.start.toISOString(),
      endIso: slot.end.toISOString(),
      title
    } satisfies SlotTokenPayload)
  );

  await postSlackMessage(
    input.channelId,
    `Open slots with ${input.target.name} — pick one to book.`,
    {
      threadTs: input.threadTs ?? input.ts,
      blocks: buildSlotBlocks({
        targetName: input.target.name,
        title,
        slots: free,
        tokens
      })
    }
  );

  return { handled: true, reason: "slots_offered" };
}

export async function processSlackCalendarMessage(input: {
  channelId: string;
  userId: string;
  text?: string;
  ts: string;
  botId?: string;
  subtype?: string;
  threadTs?: string;
  channelType?: string;
  eventType?: string;
  force?: boolean;
}): Promise<{ handled: boolean; reason?: string }> {
  if (input.botId) return { handled: false, reason: "ignored_bot" };
  if (input.subtype && input.subtype !== "thread_broadcast") {
    return { handled: false, reason: "ignored_subtype" };
  }

  const text = input.text?.trim() ?? "";
  if (!text || (!input.force && !looksLikeCalendarQuery(text))) {
    return { handled: false, reason: "not_calendar" };
  }

  const isDm = isSlackDmChannel(input.channelId, input.channelType);
  if (!isDm) {
    const botUserId = await getSlackBotUserId();
    const mentioned =
      input.eventType === "app_mention" ||
      Boolean(botUserId && textMentionsSlackUser(text, botUserId));
    if (!mentioned) return { handled: false, reason: "channel_requires_mention" };
  }

  if (!markBookingEvent(input.channelId, input.ts)) {
    return { handled: true, reason: "deduped" };
  }

  const replyOpts = { threadTs: input.threadTs ?? input.ts };

  try {
    return await processSlackCalendarMessageInner({
      ...input,
      text,
      replyOpts
    });
  } catch (error) {
    console.error("[calendar.booking] unhandled error:", error);
    try {
      await postSlackMessage(
        input.channelId,
        "Something went wrong while handling that calendar request. Reconnect Google Calendar in Bran if booking keeps failing, then try again.",
        replyOpts
      );
    } catch (postError) {
      console.error("[calendar.booking] failed to post error reply:", postError);
    }
    return { handled: true, reason: "calendar_error" };
  }
}

async function processSlackCalendarMessageInner(input: {
  channelId: string;
  userId: string;
  text: string;
  ts: string;
  threadTs?: string;
  replyOpts: { threadTs: string };
}): Promise<{ handled: boolean; reason?: string }> {
  const branUserId = await resolveBranUserIdForSlackUser(input.userId);
  if (!branUserId) {
    await postSlackMessage(
      input.channelId,
      "I couldn’t match your Slack account to a Bran user.",
      input.replyOpts
    );
    return { handled: true, reason: "unmapped_user" };
  }

  if (looksLikeCalendarAgendaQuery(input.text)) {
    return processAgendaToday({
      channelId: input.channelId,
      branUserId,
      replyOpts: input.replyOpts
    });
  }

  const ready = await assertRequesterBookingReady(branUserId);
  if (!ready.ok) {
    await postSlackMessage(input.channelId, ready.message, input.replyOpts);
    return { handled: true, reason: "not_connected" };
  }

  const requester = await prisma.user.findUnique({
    where: { id: branUserId },
    select: { id: true, name: true, email: true }
  });
  if (!requester) {
    await postSlackMessage(input.channelId, "Your Bran account wasn’t found.", input.replyOpts);
    return { handled: true, reason: "missing_requester" };
  }

  const target = await resolveBookingTarget({
    text: input.text,
    requesterUserId: branUserId,
    requesterSlackId: input.userId
  });

  if (target.kind === "missing") {
    await postSlackMessage(input.channelId, target.message, input.replyOpts);
    return { handled: true, reason: "target_missing" };
  }

  if (target.kind === "ambiguous") {
    const elements = target.users.map((user, index) => ({
      type: "button" as const,
      action_id: `${SLACK_CALENDAR_PICK_PERSON_ACTION}_${index}`,
      text: { type: "plain_text" as const, text: user.name.slice(0, 75), emoji: false },
      value: signToken({
        purpose: PERSON_TOKEN_PURPOSE,
        requesterUserId: branUserId,
        targetUserId: user.id,
        sourceText: input.text
      } satisfies PersonTokenPayload)
    }));

    await postSlackMessage(input.channelId, "Which person did you mean?", {
      ...input.replyOpts,
      blocks: [
        {
          type: "section",
          text: { type: "mrkdwn", text: "I found a few matches — pick one:" }
        },
        { type: "actions", block_id: "bran_calendar_people", elements }
      ]
    });
    return { handled: true, reason: "ambiguous_target" };
  }

  return offerSlotsForTarget({
    channelId: input.channelId,
    threadTs: input.threadTs,
    ts: input.ts,
    requesterUserId: branUserId,
    requesterName: requester.name,
    requesterRefreshToken: ready.refreshToken,
    target: target.user,
    sourceText: input.text
  });
}

async function processAgendaToday(input: {
  channelId: string;
  branUserId: string;
  replyOpts: { threadTs: string };
}): Promise<{ handled: true; reason: string }> {
  const calendar = await loadDecryptedCalendarToken(input.branUserId);
  if (!calendar) {
    await postSlackMessage(
      input.channelId,
      `Connect (or reconnect) *Google Calendar* in Bran to fetch today’s meetings:\n${meetingsAppUrl()}`,
      input.replyOpts
    );
    return { handled: true, reason: "calendar_not_ready" };
  }

  const now = new Date();
  const timeMin = startOfDayInTimezone(now);
  const timeMax = endOfDayInTimezone(now);

  try {
    const events = await listPrimaryCalendarEvents({
      refreshToken: calendar.refreshToken,
      timeMin,
      timeMax
    });

    if (events.length === 0) {
      await postSlackMessage(
        input.channelId,
        "Nothing on your calendar for today (IST).",
        input.replyOpts
      );
      return { handled: true, reason: "empty_agenda" };
    }

    const lines = events.map((event) => {
      if (event.isAllDay) {
        return `• *All day* — ${event.title}`;
      }
      const startLabel = event.start
        ? new Intl.DateTimeFormat("en-GB", {
            timeZone: env.appTimezone,
            hour: "2-digit",
            minute: "2-digit",
            hour12: false
          }).format(event.start)
        : "??:??";
      const meet = event.meetLink ? ` · <${event.meetLink}|Meet>` : "";
      return `• *${startLabel}* — ${event.title}${meet}`;
    });

    await postSlackMessage(
      input.channelId,
      `*Your calendar today (IST)*\n${lines.join("\n")}`,
      input.replyOpts
    );
    return { handled: true, reason: "agenda_posted" };
  } catch (error) {
    console.error("[calendar.booking] agenda failed:", error);
    await postSlackMessage(
      input.channelId,
      "I couldn’t read your calendar. Reconnect Google Calendar in Bran and try again.",
      input.replyOpts
    );
    return { handled: true, reason: "agenda_failed" };
  }
}

export async function processSlackCalendarBookSlotAction(input: {
  slackUserId: string;
  token: string;
  responseUrl?: string;
}): Promise<void> {
  const payload = verifyToken<SlotTokenPayload>(input.token, SLOT_TOKEN_PURPOSE);
  if (!payload) {
    if (input.responseUrl) {
      await respondToSlackResponseUrl(input.responseUrl, {
        replace_original: false,
        text: "That slot offer expired. Ask me again to book a call."
      });
    }
    return;
  }

  const branUserId = await resolveBranUserIdForSlackUser(input.slackUserId);
  if (!branUserId || branUserId !== payload.requesterUserId) {
    if (input.responseUrl) {
      await respondToSlackResponseUrl(input.responseUrl, {
        replace_original: false,
        text: "Only the person who asked to book can pick a slot."
      });
    }
    return;
  }

  const ready = await assertRequesterBookingReady(branUserId);
  if (!ready.ok) {
    if (input.responseUrl) {
      await respondToSlackResponseUrl(input.responseUrl, {
        replace_original: false,
        text: ready.message
      });
    }
    return;
  }

  const [requester, target] = await Promise.all([
    prisma.user.findUnique({
      where: { id: payload.requesterUserId },
      select: { id: true, name: true, email: true }
    }),
    prisma.user.findUnique({
      where: { id: payload.targetUserId },
      select: { id: true, name: true, email: true }
    })
  ]);

  if (!requester || !target) {
    if (input.responseUrl) {
      await respondToSlackResponseUrl(input.responseUrl, {
        replace_original: false,
        text: "I couldn’t load the people for that booking."
      });
    }
    return;
  }

  const start = new Date(payload.startIso);
  const end = new Date(payload.endIso);
  const title =
    payload.title?.trim() ||
    deriveMeetingTitle({
      text: "",
      requesterName: requester.name,
      targetName: target.name
    });

  try {
    const created = await createMeetCalendarEvent({
      refreshToken: ready.refreshToken,
      summary: title,
      description: `Booked via Bran Slack by ${requester.name}`,
      start,
      end,
      attendeeEmails: [target.email].filter(Boolean)
    });

    const when = formatSlotLabel(start, end);
    const meetLine = created.meetLink
      ? `<${created.meetLink}|Join Google Meet>`
      : "_Meet link pending — check the calendar invite._";
    const text = [
      `Booked *${created.summary}*`,
      when,
      meetLine,
      `Invite sent to ${target.email}`
    ].join("\n");

    if (input.responseUrl) {
      await respondToSlackResponseUrl(input.responseUrl, {
        replace_original: true,
        text,
        blocks: [
          {
            type: "section",
            text: { type: "mrkdwn", text }
          }
        ]
      });
    }
  } catch (error) {
    console.error("[calendar.booking] create event failed:", error);
    if (input.responseUrl) {
      await respondToSlackResponseUrl(input.responseUrl, {
        replace_original: false,
        text: "I couldn’t create that calendar event. Reconnect Calendar in Bran (with booking scopes) and try again."
      });
    }
  }
}

export async function processSlackCalendarPickPersonAction(input: {
  slackUserId: string;
  token: string;
  channelId?: string;
  responseUrl?: string;
}): Promise<void> {
  const payload = verifyToken<PersonTokenPayload>(input.token, PERSON_TOKEN_PURPOSE);
  if (!payload) {
    if (input.responseUrl) {
      await respondToSlackResponseUrl(input.responseUrl, {
        replace_original: false,
        text: "That choice expired. Ask me again to book a call."
      });
    }
    return;
  }

  const branUserId = await resolveBranUserIdForSlackUser(input.slackUserId);
  if (!branUserId || branUserId !== payload.requesterUserId) {
    if (input.responseUrl) {
      await respondToSlackResponseUrl(input.responseUrl, {
        replace_original: false,
        text: "Only the person who asked to book can pick."
      });
    }
    return;
  }

  const ready = await assertRequesterBookingReady(branUserId);
  if (!ready.ok) {
    if (input.responseUrl) {
      await respondToSlackResponseUrl(input.responseUrl, {
        replace_original: false,
        text: ready.message
      });
    }
    return;
  }

  const [requester, target] = await Promise.all([
    prisma.user.findUnique({
      where: { id: payload.requesterUserId },
      select: { id: true, name: true }
    }),
    prisma.user.findUnique({
      where: { id: payload.targetUserId },
      select: { id: true, name: true, email: true }
    })
  ]);

  if (!requester || !target || !input.channelId) {
    if (input.responseUrl) {
      await respondToSlackResponseUrl(input.responseUrl, {
        replace_original: false,
        text: "I couldn’t continue that booking."
      });
    }
    return;
  }

  if (input.responseUrl) {
    await respondToSlackResponseUrl(input.responseUrl, {
      replace_original: true,
      text: `Got it — finding slots with *${target.name}*…`
    });
  }

  await offerSlotsForTarget({
    channelId: input.channelId,
    ts: `${Date.now() / 1000}`,
    requesterUserId: branUserId,
    requesterName: requester.name,
    requesterRefreshToken: ready.refreshToken,
    target,
    sourceText: payload.sourceText
  });
}
