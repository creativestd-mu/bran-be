import { prisma } from "../../lib/prisma";
import type { CompetitorContentRecord, CompetitorSentiment } from "./competitor-content.types";

function toRecord(row: {
  searchId: string;
  searchName: string | null;
  documentId: string;
  url: string | null;
  title: string | null;
  snippet: string | null;
  source: string | null;
  sourceName: string | null;
  author: string | null;
  publishedAt: Date | null;
  sentiment: string;
  engagement: number;
  reach: number;
  estimatedViews: number;
  timezone: string;
  rawPayload: string;
}): CompetitorContentRecord {
  return {
    searchId: row.searchId,
    searchName: row.searchName ?? undefined,
    documentId: row.documentId,
    url: row.url ?? undefined,
    title: row.title ?? undefined,
    snippet: row.snippet ?? undefined,
    source: row.source ?? undefined,
    sourceName: row.sourceName ?? undefined,
    author: row.author ?? undefined,
    publishedAt: row.publishedAt?.toISOString(),
    sentiment: row.sentiment === "negative" ? "negative" : "positive",
    engagement: row.engagement,
    reach: row.reach,
    estimatedViews: row.estimatedViews,
    timezone: row.timezone,
    rawPayload: (() => {
      try {
        return JSON.parse(row.rawPayload);
      } catch {
        return {};
      }
    })()
  };
}

export async function upsertCompetitorContentRecords(
  records: CompetitorContentRecord[]
): Promise<number> {
  if (records.length === 0) {
    return 0;
  }

  await prisma.$transaction(
    records.map((record) =>
      prisma.meltwaterCompetitorContent.upsert({
        where: {
          searchId_documentId: {
            searchId: record.searchId,
            documentId: record.documentId
          }
        },
        update: {
          searchName: record.searchName,
          url: record.url,
          title: record.title,
          snippet: record.snippet,
          source: record.source,
          sourceName: record.sourceName,
          author: record.author,
          publishedAt: record.publishedAt ? new Date(record.publishedAt) : null,
          sentiment: record.sentiment,
          engagement: record.engagement,
          reach: record.reach,
          estimatedViews: record.estimatedViews,
          timezone: record.timezone,
          rawPayload: JSON.stringify(record.rawPayload ?? {})
        },
        create: {
          searchId: record.searchId,
          searchName: record.searchName,
          documentId: record.documentId,
          url: record.url,
          title: record.title,
          snippet: record.snippet,
          source: record.source,
          sourceName: record.sourceName,
          author: record.author,
          publishedAt: record.publishedAt ? new Date(record.publishedAt) : null,
          sentiment: record.sentiment,
          engagement: record.engagement,
          reach: record.reach,
          estimatedViews: record.estimatedViews,
          timezone: record.timezone,
          rawPayload: JSON.stringify(record.rawPayload ?? {})
        }
      })
    )
  );

  return records.length;
}

export async function listTopCompetitorContent(input: {
  from: Date;
  to: Date;
  sentiment: CompetitorSentiment;
  searchIds?: string[];
  limit: number;
}): Promise<CompetitorContentRecord[]> {
  const rows = await prisma.meltwaterCompetitorContent.findMany({
    where: {
      sentiment: input.sentiment,
      ...(input.searchIds && input.searchIds.length > 0
        ? { searchId: { in: input.searchIds } }
        : {}),
      OR: [
        {
          publishedAt: {
            gte: input.from,
            lte: input.to
          }
        },
        {
          publishedAt: null,
          createdAt: {
            gte: input.from,
            lte: input.to
          }
        }
      ]
    },
    orderBy: [{ engagement: "desc" }, { reach: "desc" }, { publishedAt: "desc" }],
    take: input.limit
  });

  return rows.map(toRecord);
}

export async function listCompetitorContentSearches(searchIds?: string[]): Promise<
  Array<{ searchId: string; searchName?: string }>
> {
  const rows = await prisma.meltwaterCompetitorContent.findMany({
    where: searchIds && searchIds.length > 0 ? { searchId: { in: searchIds } } : undefined,
    distinct: ["searchId"],
    select: { searchId: true, searchName: true },
    orderBy: { searchName: "asc" }
  });

  return rows.map((row) => ({
    searchId: row.searchId,
    searchName: row.searchName ?? undefined
  }));
}
