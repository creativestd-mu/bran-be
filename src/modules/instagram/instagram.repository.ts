import { prisma } from "../../lib/prisma";
import { MeltwaterSource, NormalizedInstagramRecord, Sentiment } from "./instagram.types";

type AggregateQuery = {
  source: MeltwaterSource;
  language: string;
  from?: Date;
  to?: Date;
};

type RecordsQuery = AggregateQuery & {
  page: number;
  pageSize: number;
};

function isSentiment(value: string): value is Sentiment {
  return value === "positive" || value === "neutral" || value === "negative" || value === "unknown";
}

function buildWhereClause(query: AggregateQuery) {
  return {
    source: query.source,
    language: query.language,
    ...(query.from || query.to
      ? {
          mentionedAt: {
            ...(query.from ? { gte: query.from } : {}),
            ...(query.to ? { lte: query.to } : {})
          }
        }
      : {})
  };
}

export async function upsertInstagramPerformanceRecords(
  source: MeltwaterSource,
  language: string,
  records: NormalizedInstagramRecord[]
): Promise<void> {
  await prisma.$transaction(
    records.map((record) =>
      prisma.instagramPerformance.upsert({
        where: { sourceItemId: record.sourceItemId },
        update: {
          source,
          language,
          mentionCount: record.mentionCount,
          estimatedViews: record.estimatedViews,
          estimatedReach: record.estimatedReach,
          engagementCount: record.engagementCount,
          engagementRate: record.engagementRate,
          sentiment: record.sentiment,
          mentionedAt: record.mentionedAt,
          rawPayload: JSON.stringify(record.rawPayload ?? {})
        },
        create: {
          source,
          sourceItemId: record.sourceItemId,
          language,
          mentionCount: record.mentionCount,
          estimatedViews: record.estimatedViews,
          estimatedReach: record.estimatedReach,
          engagementCount: record.engagementCount,
          engagementRate: record.engagementRate,
          sentiment: record.sentiment,
          mentionedAt: record.mentionedAt,
          rawPayload: JSON.stringify(record.rawPayload ?? {})
        }
      })
    )
  );
}

export async function getInstagramAggregatedMetrics(query: AggregateQuery) {
  const where = buildWhereClause(query);

  const [totals, sentimentGroups] = await Promise.all([
    prisma.instagramPerformance.aggregate({
      where,
      _sum: {
        mentionCount: true,
        estimatedViews: true,
        estimatedReach: true,
        engagementCount: true
      },
      _avg: {
        engagementRate: true
      }
    }),
    prisma.instagramPerformance.groupBy({
      where,
      by: ["sentiment"],
      _sum: {
        mentionCount: true
      }
    })
  ]);

  const sentiment: Record<Sentiment, number> = {
    positive: 0,
    neutral: 0,
    negative: 0,
    unknown: 0
  };

  for (const group of sentimentGroups) {
    if (isSentiment(group.sentiment)) {
      sentiment[group.sentiment] = group._sum.mentionCount ?? 0;
    }
  }

  return {
    mentions: totals._sum.mentionCount ?? 0,
    estimatedViews: totals._sum.estimatedViews ?? 0,
    estimatedReach: totals._sum.estimatedReach ?? 0,
    engagementCount: totals._sum.engagementCount ?? 0,
    engagementRateAvg: totals._avg.engagementRate ?? 0,
    sentiment
  };
}

export async function listInstagramRecords(query: RecordsQuery) {
  const where = buildWhereClause(query);
  const skip = (query.page - 1) * query.pageSize;

  const [total, items] = await Promise.all([
    prisma.instagramPerformance.count({ where }),
    prisma.instagramPerformance.findMany({
      where,
      orderBy: {
        mentionedAt: "desc"
      },
      skip,
      take: query.pageSize
    })
  ]);

  return { total, items };
}
