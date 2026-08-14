import { env } from "../../config/env";
import { HttpError } from "../../utils/httpError";
import {
  MeltwaterCustomAnalyticsRequest,
  MeltwaterSearch,
  MeltwaterSearchRequest
} from "./meltwater-earned.types";

function devLog(message: string, payload?: Record<string, unknown>): void {
  if (env.nodeEnv === "production") {
    return;
  }
  console.log("[meltwater-earned]", message, payload ?? {});
}

const PLACEHOLDER_API_KEYS = new Set([
  "",
  "your_meltwater_api_key",
  "changeme",
  "replace_me"
]);

function requireApiConfig(): { baseUrl: string; apiKey: string } {
  if (!env.meltwaterBaseUrl) {
    throw new HttpError(500, "MELTWATER_BASE_URL is missing");
  }
  if (PLACEHOLDER_API_KEYS.has(env.meltwaterApiKey.toLowerCase())) {
    throw new HttpError(
      500,
      "MELTWATER_API_KEY is missing or still the placeholder. Set the real token from Meltwater → Account → API Credentials."
    );
  }
  return { baseUrl: env.meltwaterBaseUrl, apiKey: env.meltwaterApiKey };
}

async function meltwaterFetch(url: string, init: RequestInit): Promise<unknown> {
  const { apiKey } = requireApiConfig();
  const response = await fetch(url, {
    ...init,
    headers: {
      apikey: apiKey,
      Accept: "application/json",
      ...(init.headers ?? {})
    }
  });

  if (!response.ok) {
    const responseText = await response.text();
    devLog("request.failed", {
      url,
      status: response.status,
      responseSnippet: responseText.slice(0, 500)
    });
    if (response.status === 401) {
      throw new HttpError(
        401,
        "Meltwater rejected the API key (401). Check MELTWATER_API_KEY in this environment — it must be the token from Meltwater → Account → API Credentials, not the example placeholder."
      );
    }
    if (response.status === 403) {
      throw new HttpError(
        403,
        "Meltwater authenticated the key but denied this endpoint (403). Earned sentiment needs a Listening/Explore API package, not owned-social only."
      );
    }
    throw new HttpError(502, `Meltwater request failed with status ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new HttpError(502, "Meltwater response is not JSON");
  }

  return response.json();
}

export async function listMeltwaterSearches(): Promise<MeltwaterSearch[]> {
  const { baseUrl } = requireApiConfig();
  const url = new URL("/v3/searches", baseUrl).toString();
  devLog("searches.start", { url });

  const json = (await meltwaterFetch(url, { method: "GET" })) as {
    searches?: Array<{ id?: unknown; name?: unknown; updated?: unknown }>;
  };

  const searches = Array.isArray(json.searches) ? json.searches : [];
  return searches
    .map((search) => ({
      id: String(search.id ?? "").trim(),
      name: String(search.name ?? "").trim(),
      updated: search.updated ? String(search.updated) : undefined
    }))
    .filter((search) => search.id.length > 0);
}

export async function createMeltwaterSearch(
  name: string,
  booleanQuery: string,
  caseSensitivity: "no" | "yes" | "hybrid" = "no"
): Promise<MeltwaterSearch> {
  const { baseUrl } = requireApiConfig();
  const url = new URL("/v3/searches", baseUrl).toString();
  devLog("searches.create", { url, name });

  const json = (await meltwaterFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      search: {
        name,
        query: {
          type: "boolean",
          boolean: booleanQuery,
          case_sensitivity: caseSensitivity
        }
      }
    })
  })) as { search?: { id?: unknown; name?: unknown; updated?: unknown } };

  const search = json.search ?? {};
  const id = String(search.id ?? "").trim();
  if (!id) {
    throw new HttpError(502, "Meltwater created the search but returned no id");
  }

  return {
    id,
    name: String(search.name ?? name).trim(),
    updated: search.updated ? String(search.updated) : undefined
  };
}

export async function fetchMeltwaterCustomAnalytics(
  searchId: string,
  body: MeltwaterCustomAnalyticsRequest
): Promise<unknown> {
  const { baseUrl } = requireApiConfig();
  const url = new URL(`/v3/analytics/${encodeURIComponent(searchId)}/custom`, baseUrl).toString();
  devLog("analytics.start", {
    searchId,
    start: body.start,
    end: body.end,
    analysisType: body.analysis.type,
    nestedType: body.analysis.analysis?.type
  });

  return meltwaterFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

export async function searchMeltwaterMentions(
  searchId: string,
  body: MeltwaterSearchRequest
): Promise<unknown> {
  const { baseUrl } = requireApiConfig();
  const url = new URL(`/v3/search/${encodeURIComponent(searchId)}`, baseUrl).toString();
  devLog("search.start", {
    searchId,
    start: body.start,
    end: body.end,
    sortBy: body.sort_by,
    sentiments: body.sentiments,
    pageSize: body.page_size
  });

  return meltwaterFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}
