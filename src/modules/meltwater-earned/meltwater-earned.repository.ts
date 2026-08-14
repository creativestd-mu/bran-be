import { prisma } from "../../lib/prisma";
import { EMPTY_SENTIMENT } from "./meltwater-earned.constants";
import { MeltwaterEarnedTotals, NormalizedEarnedDaily } from "./meltwater-earned.types";

function toDateOnly(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

function dateKeyFromValue(value: Date): string {
  return value.toISOString().slice(0, 10);
}

type DailyQuery = {
  searchId?: string;
  from?: string;
  to?: string;
  timezone?: string;
};

function buildWhere(query: DailyQuery) {
  return {
    ...(query.searchId ? { searchId: query.searchId } : {}),
    ...(query.timezone ? { timezone: query.timezone } : {}),
    ...(query.from || query.to
      ? {
          date: {
            ...(query.from ? { gte: toDateOnly(query.from) } : {}),
            ...(query.to ? { lte: toDateOnly(query.to) } : {})
          }
        }
      : {})
  };
}

export async function upsertEarnedDailyRecords(records: NormalizedEarnedDaily[]): Promise<number> {
  if (records.length === 0) {
    return 0;
  }

  await prisma.$transaction(
    records.map((record) =>
      prisma.meltwaterEarnedDaily.upsert({
        where: {
          searchId_date_timezone: {
            searchId: record.searchId,
            date: toDateOnly(record.date),
            timezone: record.timezone
          }
        },
        update: {
          searchName: record.searchName,
          mentionCount: record.mentionCount,
          reach: record.reach,
          estimatedViews: record.estimatedViews,
          sentimentPositive: record.sentiment.positive,
          sentimentNeutral: record.sentiment.neutral,
          sentimentNegative: record.sentiment.negative,
          sentimentUnknown: record.sentiment.unknown,
          rawPayload: JSON.stringify(record.rawPayload ?? {})
        },
        create: {
          searchId: record.searchId,
          searchName: record.searchName,
          date: toDateOnly(record.date),
          timezone: record.timezone,
          mentionCount: record.mentionCount,
          reach: record.reach,
          estimatedViews: record.estimatedViews,
          sentimentPositive: record.sentiment.positive,
          sentimentNeutral: record.sentiment.neutral,
          sentimentNegative: record.sentiment.negative,
          sentimentUnknown: record.sentiment.unknown,
          rawPayload: JSON.stringify(record.rawPayload ?? {})
        }
      })
    )
  );

  return records.length;
}

export async function listEarnedDaily(query: DailyQuery) {
  const where = buildWhere(query);
  const items = await prisma.meltwaterEarnedDaily.findMany({
    where,
    orderBy: [{ date: "asc" }, { searchId: "asc" }]
  });

  return items.map((item) => ({
    id: item.id,
    searchId: item.searchId,
    searchName: item.searchName,
    date: dateKeyFromValue(item.date),
    timezone: item.timezone,
    mentionCount: item.mentionCount,
    reach: item.reach,
    estimatedViews: item.estimatedViews,
    sentiment: {
      positive: item.sentimentPositive,
      neutral: item.sentimentNeutral,
      negative: item.sentimentNegative,
      unknown: item.sentimentUnknown
    },
    updatedAt: item.updatedAt
  }));
}

export async function aggregateEarnedDaily(query: DailyQuery): Promise<MeltwaterEarnedTotals> {
  const where = buildWhere(query);
  const totals = await prisma.meltwaterEarnedDaily.aggregate({
    where,
    _sum: {
      mentionCount: true,
      reach: true,
      estimatedViews: true,
      sentimentPositive: true,
      sentimentNeutral: true,
      sentimentNegative: true,
      sentimentUnknown: true
    }
  });

  return {
    mentionCount: totals._sum.mentionCount ?? 0,
    reach: totals._sum.reach ?? 0,
    estimatedViews: totals._sum.estimatedViews ?? 0,
    sentiment: {
      positive: totals._sum.sentimentPositive ?? 0,
      neutral: totals._sum.sentimentNeutral ?? 0,
      negative: totals._sum.sentimentNegative ?? 0,
      unknown: totals._sum.sentimentUnknown ?? 0
    }
  };
}

export function emptyTotals(): MeltwaterEarnedTotals {
  return {
    mentionCount: 0,
    reach: 0,
    estimatedViews: 0,
    sentiment: { ...EMPTY_SENTIMENT }
  };
}
