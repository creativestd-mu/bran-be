import { createHash } from "crypto";

import { prisma } from "../../lib/prisma";
import type { SlackIntentId } from "./slack-intents.catalog";

export function normalizeSlackIntentQuery(text: string): string {
  return text
    .replace(/<@[A-Z0-9]+>/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .slice(0, 500);
}

export function catalogVectorPointId(intent: string, example: string): string {
  const hex = createHash("sha256").update(`catalog:${intent}:${example}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export async function createSlackIntentSuggestion(data: {
  slackUserId: string;
  branUserId?: string | null;
  channelId: string;
  channelType?: string | null;
  threadTs?: string | null;
  messageTs: string;
  originalText: string;
  eventType?: string | null;
  isDm: boolean;
  candidates: Array<{ intent: SlackIntentId; label: string; score: number }>;
}) {
  return prisma.slackIntentSuggestion.create({
    data: {
      slackUserId: data.slackUserId,
      branUserId: data.branUserId ?? null,
      channelId: data.channelId,
      channelType: data.channelType ?? null,
      threadTs: data.threadTs ?? null,
      messageTs: data.messageTs,
      originalText: data.originalText,
      eventType: data.eventType ?? null,
      isDm: data.isDm,
      candidatesJson: JSON.stringify(data.candidates),
      status: "SUGGESTED"
    }
  });
}

export async function setSlackIntentSuggestionReplyTs(id: string, replyTs: string) {
  return prisma.slackIntentSuggestion.update({
    where: { id },
    data: { replyTs }
  });
}

export async function getSlackIntentSuggestion(id: string) {
  return prisma.slackIntentSuggestion.findUnique({ where: { id } });
}

export async function markSlackIntentSuggestion(
  id: string,
  data: { status: "EXECUTED" | "DISMISSED"; chosenIntent?: string | null }
) {
  return prisma.slackIntentSuggestion.update({
    where: { id },
    data: {
      status: data.status,
      chosenIntent: data.chosenIntent ?? null
    }
  });
}

export async function upsertSlackIntentExample(data: {
  ownerBranUserId?: string | null;
  normalizedQuery: string;
  intent: string;
  source?: "confirmed" | "auto";
}) {
  const normalizedQuery = data.normalizedQuery.slice(0, 500);
  if (!normalizedQuery) return null;

  return prisma.slackIntentExample.upsert({
    where: { normalizedQuery },
    create: {
      ownerBranUserId: data.ownerBranUserId ?? null,
      normalizedQuery,
      intent: data.intent,
      source: data.source ?? "confirmed"
    },
    update: {
      ownerBranUserId: data.ownerBranUserId ?? null,
      intent: data.intent,
      source: data.source ?? "confirmed"
    }
  });
}

export async function listRecentSlackIntentExamples(limit = 40) {
  return prisma.slackIntentExample.findMany({
    orderBy: { updatedAt: "desc" },
    take: limit
  });
}
