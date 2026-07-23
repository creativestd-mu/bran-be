import { prisma } from "../../lib/prisma";
import {
  DEFAULT_DETECT_LOOKBACK_DAYS,
  DEFAULT_DETECT_MAX_CANDIDATES,
  type OrgEventSourceType
} from "./events.constants";

export type SourceCandidate = {
  sourceType: Exclude<OrgEventSourceType, "MANUAL">;
  sourceId: string;
  title: string;
  body: string;
  actorUserId?: string | null;
  actorName?: string | null;
  occurredAt: Date;
  metadata?: Record<string, unknown>;
};

function lookbackDate(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

const MEETING_TRANSCRIPT_BODY_MAX = 2000;

function hasUsableTranscript(transcript: string | null | undefined): boolean {
  return Boolean(transcript?.trim());
}

type MeetingWithTranscript = {
  id: string;
  title: string | null;
  meetingUrl: string;
  status: string;
  startTime: Date | null;
  createdAt: Date;
  organizerUserId: string;
  organizer: { name: string; email: string };
  voiceRecording: { transcript: string | null } | null;
};

function meetingTranscriptCandidate(meeting: MeetingWithTranscript): SourceCandidate | null {
  const transcript = meeting.voiceRecording?.transcript?.trim();
  if (!hasUsableTranscript(transcript)) return null;

  return {
    sourceType: "MEETING",
    sourceId: meeting.id,
    title: meeting.title ?? "Meeting transcript",
    body: transcript!.slice(0, MEETING_TRANSCRIPT_BODY_MAX),
    actorUserId: meeting.organizerUserId,
    actorName: meeting.organizer.name ?? meeting.organizer.email,
    occurredAt: meeting.startTime ?? meeting.createdAt,
    metadata: {
      status: meeting.status,
      meetingUrl: meeting.meetingUrl,
      hasTranscript: true
    }
  };
}

async function attachedSourceKeys(): Promise<Set<string>> {
  const rows = await prisma.orgEventUpdate.findMany({
    where: { sourceType: { not: "MANUAL" } },
    select: { sourceType: true, sourceId: true }
  });
  return new Set(rows.map((row) => `${row.sourceType}:${row.sourceId}`));
}

export async function loadUnattachedSourceCandidates(options?: {
  days?: number;
  maxCandidates?: number;
  sourceType?: Exclude<OrgEventSourceType, "MANUAL">;
}): Promise<SourceCandidate[]> {
  const days = options?.days ?? DEFAULT_DETECT_LOOKBACK_DAYS;
  const maxCandidates = options?.maxCandidates ?? DEFAULT_DETECT_MAX_CANDIDATES;
  const since = lookbackDate(days);
  const attached = await attachedSourceKeys();
  const filter = options?.sourceType;
  const candidates: SourceCandidate[] = [];

  const push = (candidate: SourceCandidate) => {
    if (filter && candidate.sourceType !== filter) return;
    const key = `${candidate.sourceType}:${candidate.sourceId}`;
    if (attached.has(key)) return;
    candidates.push(candidate);
  };

  if (!filter || filter === "GMAIL") {
    const messages = await prisma.gmailMessage.findMany({
      where: {
        OR: [{ receivedAt: { gte: since } }, { receivedAt: null, createdAt: { gte: since } }]
      },
      orderBy: [{ receivedAt: "desc" }, { createdAt: "desc" }],
      take: maxCandidates,
      include: { connection: { select: { userId: true, oauthEmail: true } } }
    });
    for (const message of messages) {
      push({
        sourceType: "GMAIL",
        sourceId: message.id,
        title: message.subject ?? "(no subject)",
        body: message.snippet ?? message.bodyText?.slice(0, 500) ?? "",
        actorUserId: message.connection.userId,
        actorName: message.fromAddress ?? message.connection.oauthEmail,
        occurredAt: message.receivedAt ?? message.createdAt,
        metadata: { gmailMessageId: message.gmailMessageId, threadId: message.threadId }
      });
    }
  }

  // Only meetings with a processed transcript — bare Meet calls are not events.
  if (!filter || filter === "MEETING") {
    const meetings = await prisma.meeting.findMany({
      where: {
        createdAt: { gte: since },
        voiceRecordingId: { not: null },
        voiceRecording: {
          is: {
            transcript: { not: null }
          }
        }
      },
      orderBy: { createdAt: "desc" },
      take: maxCandidates,
      include: {
        organizer: { select: { id: true, name: true, email: true } },
        voiceRecording: { select: { transcript: true } }
      }
    });
    for (const meeting of meetings) {
      const candidate = meetingTranscriptCandidate(meeting);
      if (candidate) push(candidate);
    }
  }

  if (!filter || filter === "ESCALATION") {
    const escalations = await prisma.escalation.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: maxCandidates
    });
    for (const escalation of escalations) {
      push({
        sourceType: "ESCALATION",
        sourceId: escalation.id,
        title: escalation.title,
        body: escalation.latestContext || escalation.problemContext,
        actorName: escalation.reporterName ?? escalation.reporterEmail,
        occurredAt: escalation.latestUpdateAt ?? escalation.createdAt,
        metadata: { status: escalation.status, priority: escalation.priority }
      });
    }
  }

  // ATTENDANCE (ETA / WFH / leave) is intentionally NOT loaded — it is
  // operational HR data, not an org/business/student topic, so it must never
  // be clustered into or attached as an org event.

  if (!filter || filter === "WORK_UNIT") {
    const workUnits = await prisma.workUnit.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: maxCandidates,
      include: {
        user: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true, email: true } }
      }
    });
    for (const unit of workUnits) {
      push({
        sourceType: "WORK_UNIT",
        sourceId: unit.id,
        title: unit.title,
        body: unit.context?.slice(0, 500) ?? `Work unit status: ${unit.status}`,
        actorUserId: unit.createdById ?? unit.userId,
        actorName: unit.createdBy?.name ?? unit.user.name ?? unit.user.email,
        occurredAt: unit.updatedAt ?? unit.createdAt,
        metadata: { status: unit.status, ownerUserId: unit.userId }
      });
    }
  }

  candidates.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
  return candidates.slice(0, maxCandidates);
}

export async function resolveSourceCandidate(
  sourceType: Exclude<OrgEventSourceType, "MANUAL">,
  sourceId: string
): Promise<SourceCandidate | null> {
  const list = await loadUnattachedSourceCandidates({
    days: 90,
    maxCandidates: 500,
    sourceType
  });
  const found = list.find((item) => item.sourceId === sourceId);
  if (found) return found;

  // Also allow re-resolving already-attached sources for attach validation errors;
  // fetch directly when not in unattached set.
  switch (sourceType) {
    case "GMAIL": {
      const message = await prisma.gmailMessage.findUnique({
        where: { id: sourceId },
        include: { connection: { select: { userId: true, oauthEmail: true } } }
      });
      if (!message) return null;
      return {
        sourceType,
        sourceId: message.id,
        title: message.subject ?? "(no subject)",
        body: message.snippet ?? message.bodyText?.slice(0, 500) ?? "",
        actorUserId: message.connection.userId,
        actorName: message.fromAddress ?? message.connection.oauthEmail,
        occurredAt: message.receivedAt ?? message.createdAt
      };
    }
    case "MEETING": {
      const meeting = await prisma.meeting.findUnique({
        where: { id: sourceId },
        include: {
          organizer: { select: { id: true, name: true, email: true } },
          voiceRecording: { select: { transcript: true } }
        }
      });
      if (!meeting) return null;
      return meetingTranscriptCandidate(meeting);
    }
    case "ESCALATION": {
      const escalation = await prisma.escalation.findUnique({ where: { id: sourceId } });
      if (!escalation) return null;
      return {
        sourceType,
        sourceId: escalation.id,
        title: escalation.title,
        body: escalation.latestContext || escalation.problemContext,
        actorName: escalation.reporterName ?? escalation.reporterEmail,
        occurredAt: escalation.latestUpdateAt ?? escalation.createdAt
      };
    }
    // ATTENDANCE intentionally unsupported — not an org/business/student topic.
    case "WORK_UNIT": {
      const unit = await prisma.workUnit.findUnique({
        where: { id: sourceId },
        include: {
          user: { select: { name: true, email: true } },
          createdBy: { select: { id: true, name: true, email: true } }
        }
      });
      if (!unit) return null;
      return {
        sourceType,
        sourceId: unit.id,
        title: unit.title,
        body: unit.context?.slice(0, 500) ?? unit.status,
        actorUserId: unit.createdById ?? unit.userId,
        actorName: unit.createdBy?.name ?? unit.user.name ?? unit.user.email,
        occurredAt: unit.updatedAt ?? unit.createdAt
      };
    }
    default:
      return null;
  }
}
