import { env } from "../../config/env";
import { HttpError } from "../../utils/httpError";
import {
  MeltwaterCustomAnalyticsRequest,
  MeltwaterSearch
} from "./meltwater-earned.types";

function devLog(message: string, payload?: Record<string, unknown>): void {
  if (env.nodeEnv === "production") {
    return;
  }
  console.log("[meltwater-earned]", message, payload ?? {});
}

function requireApiConfig(): { baseUrl: string; apiKey: string } {
  if (!env.meltwaterBaseUrl) {
    throw new HttpError(500, "MELTWATER_BASE_URL is missing");
  }
  if (!env.meltwaterApiKey) {
    throw new HttpError(500, "MELTWATER_API_KEY is missing");
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
