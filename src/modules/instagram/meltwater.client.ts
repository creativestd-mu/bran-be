import { env } from "../../config/env";
import { HttpError } from "../../utils/httpError";
import { MeltwaterFetchParams, MeltwaterSource } from "./instagram.types";

function devLog(message: string, payload?: Record<string, unknown>): void {
  if (env.nodeEnv === "production") {
    return;
  }

  console.log("[meltwater]", message, payload ?? {});
}

function toDateOnly(value: string): string {
  return value.slice(0, 10);
}

function dateDaysAgo(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function toFinitePositiveNumber(value: unknown): number | undefined {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return undefined;
}

type OwnedPostsResponse = {
  count?: unknown;
  page?: unknown;
  page_size?: unknown;
  posts?: unknown;
};

function accountIdsForSource(source: MeltwaterSource): string[] {
  if (source === "linkedin") {
    return env.meltwaterAccountIdsLinkedin;
  }
  if (source === "youtube") {
    return env.meltwaterAccountIdsYoutube;
  }
  if (source === "facebook") {
    return env.meltwaterAccountIdsFacebook;
  }
  return env.meltwaterAccountIdsInstagram;
}

function buildMeltwaterUrl(params: MeltwaterFetchParams, page = 1, pageSize = 100): string {
  if (!env.meltwaterBaseUrl) {
    throw new HttpError(500, "MELTWATER_BASE_URL is missing");
  }
  const accountIds = accountIdsForSource(params.source);
  if (accountIds.length === 0) {
    throw new HttpError(500, `MELTWATER_ACCOUNT_IDS_${params.source.toUpperCase()} is missing`);
  }

  const baseUrl = new URL(env.meltwaterBaseUrl);
  const url = new URL(env.meltwaterOwnedPostsEndpoint, env.meltwaterBaseUrl);
  if (url.hostname !== baseUrl.hostname) {
    throw new HttpError(
      500,
      "MELTWATER_OWNED_POSTS_ENDPOINT must be a Meltwater API path, not a social profile URL"
    );
  }

  // Meltwater owned posts requires these query params.
  url.searchParams.set("source", params.source);
  url.searchParams.set("account_ids", accountIds.join(","));
  const start = params.from ? toDateOnly(params.from) : dateDaysAgo(365);
  const end = params.to ? toDateOnly(params.to) : dateDaysAgo(0);
  url.searchParams.set("start", start);
  url.searchParams.set("end", end);
  url.searchParams.set("page", String(page));
  url.searchParams.set("page_size", String(pageSize));
  if (params.keyword) {
    url.searchParams.set("keyword", params.keyword);
  }

  return url.toString();
}

export async function fetchMeltwaterOwnedPostsData(params: MeltwaterFetchParams): Promise<unknown> {
  if (!env.meltwaterApiKey) {
    throw new HttpError(500, "MELTWATER_API_KEY is missing");
  }

  const requestUrl = buildMeltwaterUrl(params);
  devLog("request.start", {
    source: params.source,
    url: requestUrl
  });

  const response = await fetch(requestUrl, {
    method: "GET",
    headers: {
      apikey: env.meltwaterApiKey,
      Accept: "application/json"
    }
  });
  devLog("request.response", {
    source: params.source,
    status: response.status,
    statusText: response.statusText
  });

  if (!response.ok) {
    const responseText = await response.text();
    devLog("request.failed", {
      source: params.source,
      status: response.status,
      responseSnippet: responseText.slice(0, 500)
    });
    throw new HttpError(502, `Meltwater request failed with status ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    const responseText = await response.text();
    devLog("request.invalid-content-type", {
      source: params.source,
      contentType,
      responseSnippet: responseText.slice(0, 500)
    });
    throw new HttpError(502, "Meltwater response is not JSON");
  }

  const json = (await response.json()) as OwnedPostsResponse;
  const itemCount =
    json && typeof json === "object" && "count" in (json as Record<string, unknown>)
      ? (json as Record<string, unknown>).count
      : undefined;
  devLog("request.success", {
    source: params.source,
    contentType,
    count: typeof itemCount === "number" ? itemCount : undefined
  });

  if (!Array.isArray(json.posts)) {
    return json;
  }

  const totalCount = toFinitePositiveNumber(json.count);
  const responsePageSize = toFinitePositiveNumber(json.page_size) ?? 100;
  const totalPages = totalCount ? Math.ceil(totalCount / responsePageSize) : 1;

  if (totalPages <= 1) {
    return json;
  }

  const maxPages = Math.min(totalPages, 50);
  const mergedPosts = [...json.posts];
  for (let page = 2; page <= maxPages; page += 1) {
    const pagedUrl = buildMeltwaterUrl(params, page, responsePageSize);
    devLog("request.page.start", {
      source: params.source,
      page,
      url: pagedUrl
    });

    const pagedResponse = await fetch(pagedUrl, {
      method: "GET",
      headers: {
        apikey: env.meltwaterApiKey,
        Accept: "application/json"
      }
    });

    if (!pagedResponse.ok) {
      const responseText = await pagedResponse.text();
      devLog("request.page.failed", {
        source: params.source,
        page,
        status: pagedResponse.status,
        responseSnippet: responseText.slice(0, 500)
      });
      throw new HttpError(502, `Meltwater request failed on page ${page} with status ${pagedResponse.status}`);
    }

    const pagedJson = (await pagedResponse.json()) as OwnedPostsResponse;
    if (!Array.isArray(pagedJson.posts) || pagedJson.posts.length === 0) {
      break;
    }

    mergedPosts.push(...pagedJson.posts);
  }

  devLog("request.pagination.complete", {
    source: params.source,
    pagesFetched: maxPages,
    mergedPosts: mergedPosts.length
  });

  return {
    ...json,
    count: mergedPosts.length,
    page: 1,
    page_size: mergedPosts.length,
    posts: mergedPosts
  };

}
