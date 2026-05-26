import { HttpError } from "../../utils/httpError";
import { env } from "../../config/env";
import { normalizeMeltwaterInstagramPayload } from "./instagram.normalize";
import {
  getInstagramAggregatedMetrics,
  listInstagramRecords,
  upsertInstagramPerformanceRecords
} from "./instagram.repository";
import { fetchMeltwaterOwnedPostsData } from "./meltwater.client";
import { MeltwaterSource } from "./instagram.types";

function devLog(message: string, payload?: Record<string, unknown>): void {
  if (env.nodeEnv === "production") {
    return;
  }

  console.log("[social-sync]", message, payload ?? {});
}

function parseOptionalDate(value?: string): Date | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new HttpError(400, `Invalid date provided: ${value}`);
  }

  return parsed;
}

function parseRawPayload(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

async function syncPerformanceData(source: MeltwaterSource, input: {
  language: string;
  from?: string;
  to?: string;
  keyword?: string;
}) {
  devLog("sync.start", {
    source,
    language: input.language,
    from: input.from,
    to: input.to,
    hasKeyword: Boolean(input.keyword)
  });

  const rawPayload = await fetchMeltwaterOwnedPostsData({
    source,
    from: input.from,
    to: input.to,
    keyword: input.keyword
  });

  const normalizedRecords = normalizeMeltwaterInstagramPayload(rawPayload);
  devLog("sync.normalized", {
    source,
    records: normalizedRecords.length
  });

  if (normalizedRecords.length === 0) {
    throw new HttpError(
      422,
      `No ${source} performance records returned by Meltwater. Check account IDs and filter range.`
    );
  }
  await upsertInstagramPerformanceRecords(source, input.language, normalizedRecords);
  devLog("sync.stored", {
    source,
    stored: normalizedRecords.length
  });

  return {
    fetched: normalizedRecords.length,
    stored: normalizedRecords.length
  };
}

export async function syncInstagramPerformanceData(input: {
  language: string;
  from?: string;
  to?: string;
  keyword?: string;
}) {
  return syncPerformanceData("instagram", input);
}

export async function syncLinkedinPerformanceData(input: {
  language: string;
  from?: string;
  to?: string;
  keyword?: string;
}) {
  return syncPerformanceData("linkedin", input);
}

export async function syncYoutubePerformanceData(input: {
  language: string;
  from?: string;
  to?: string;
  keyword?: string;
}) {
  return syncPerformanceData("youtube", input);
}

export async function syncFacebookPerformanceData(input: {
  language: string;
  from?: string;
  to?: string;
  keyword?: string;
}) {
  return syncPerformanceData("facebook", input);
}

async function aggregatePerformanceData(source: MeltwaterSource, input: {
  language: string;
  from?: string;
  to?: string;
}) {
  const from = parseOptionalDate(input.from);
  const to = parseOptionalDate(input.to);
  const metrics = await getInstagramAggregatedMetrics({
    source,
    language: input.language,
    from,
    to
  });

  return {
    ...metrics,
    source,
    range: {
      from: input.from,
      to: input.to
    }
  };
}

export async function aggregateInstagramPerformanceData(input: {
  language: string;
  from?: string;
  to?: string;
}) {
  return aggregatePerformanceData("instagram", input);
}

export async function aggregateLinkedinPerformanceData(input: {
  language: string;
  from?: string;
  to?: string;
}) {
  return aggregatePerformanceData("linkedin", input);
}

export async function aggregateYoutubePerformanceData(input: {
  language: string;
  from?: string;
  to?: string;
}) {
  return aggregatePerformanceData("youtube", input);
}

export async function aggregateFacebookPerformanceData(input: {
  language: string;
  from?: string;
  to?: string;
}) {
  return aggregatePerformanceData("facebook", input);
}

async function getPerformanceRecords(source: MeltwaterSource, input: {
  language: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}) {
  const from = parseOptionalDate(input.from);
  const to = parseOptionalDate(input.to);
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 20;

  const recordsResult = await listInstagramRecords({
    source,
    language: input.language,
    from,
    to,
    page,
    pageSize
  });

  const items = recordsResult.items.map((record) => ({
    ...record,
    rawPayload: parseRawPayload(record.rawPayload)
  }));

  const totalPages = Math.max(1, Math.ceil(recordsResult.total / pageSize));
  return {
    items,
    pagination: {
      page,
      pageSize,
      total: recordsResult.total,
      totalPages,
      hasNextPage: page < totalPages
    }
  };
}

export async function getInstagramPerformanceRecords(input: {
  language: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}) {
  return getPerformanceRecords("instagram", input);
}

export async function getLinkedinPerformanceRecords(input: {
  language: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}) {
  return getPerformanceRecords("linkedin", input);
}

export async function getYoutubePerformanceRecords(input: {
  language: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}) {
  return getPerformanceRecords("youtube", input);
}

export async function getFacebookPerformanceRecords(input: {
  language: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}) {
  return getPerformanceRecords("facebook", input);
}
