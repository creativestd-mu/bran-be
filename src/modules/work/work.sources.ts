import { env } from "../../config/env";
import { prisma } from "../../lib/prisma";
import { isMeetingNoiseEmail } from "../events/events.sources";
import {
  DEFAULT_WORK_INGEST_LOOKBACK_DAYS,
  DEFAULT_WORK_INGEST_MAX_PER_SOURCE,
  type WorkIngestSourceType
} from "./work.constants";
import { loadProcessedSourceKeys } from "./work.source-ledger";

export type WorkIngestCandidate = {
  sourceType: WorkIngestSourceType;
  sourceId: string;
  ownerUserId: string;
  title: string;
  text: string;
  occurredAt: Date;
};

function lookbackDate(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function buildEmailIngestText(message: {
  subject: string | null;
  fromAddress: string | null;
  toAddresses: string | null;
  snippet: string | null;
  bodyText: string | null;
}): string {
  const parts = [
    message.subject ? `Subject: ${message.subject}` : null,
    message.fromAddress ? `From: ${message.fromAddress}` : null,
    message.toAddresses ? `To: ${message.toAddresses}` : null,
    "",
    message.bodyText?.trim() || message.snippet?.trim() || ""
  ].filter((part) => part !== null);

  return parts.join("\n").trim();
}

export async function loadGmailWorkIngestCandidates(options?: {
  days?: number;
  maxPerRun?: number;
}): Promise<WorkIngestCandidate[]> {
  const days = options?.days ?? env.workIngestLookbackDays ?? DEFAULT_WORK_INGEST_LOOKBACK_DAYS;
  const maxPerRun = options?.maxPerRun ?? env.workIngestMaxPerSource ?? DEFAULT_WORK_INGEST_MAX_PER_SOURCE;
  const since = lookbackDate(days);

  const processed = await loadProcessedSourceKeys("GMAIL");
  const candidates: WorkIngestCandidate[] = [];

  const connections = await prisma.gmailConnection.findMany({
    where: { status: "CONNECTED" },
    select: { id: true, userId: true }
  });

  for (const connection of connections) {
    if (candidates.length >= maxPerRun) break;

    const messages = await prisma.gmailMessage.findMany({
      where: {
        connectionId: connection.id,
        OR: [{ receivedAt: { gte: since } }, { receivedAt: null, createdAt: { gte: since } }]
      },
      orderBy: [{ receivedAt: "desc" }, { createdAt: "desc" }],
      take: maxPerRun
    });

    for (const message of messages) {
      if (candidates.length >= maxPerRun) break;
      if (processed.has(message.id)) continue;

      if (
        isMeetingNoiseEmail({
          subject: message.subject,
          fromAddress: message.fromAddress,
          snippet: message.snippet,
          bodyText: message.bodyText
        })
      ) {
        continue;
      }

      const text = buildEmailIngestText(message);
      if (text.length < 40) continue;

      candidates.push({
        sourceType: "GMAIL",
        sourceId: message.id,
        ownerUserId: connection.userId,
        title: message.subject ?? "(no subject)",
        text,
        occurredAt: message.receivedAt ?? message.createdAt
      });
    }
  }

  return candidates;
}
