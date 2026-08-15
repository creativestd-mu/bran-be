import { callWorkLlm, isWorkExtractionAiConfigured } from "../work/work.extraction";
import type { CompetitorContentImpact, CompetitorContentRecord } from "../competitor-content/competitor-content.types";

export type BrandContentSummary = {
  positive: string;
  negative: string;
  positiveExampleUrl?: string;
  negativeExampleUrl?: string;
};

function pieceLine(piece: CompetitorContentRecord): string {
  const text = (piece.title || piece.snippet || "Untitled").replace(/\s+/g, " ").trim();
  return `- engagement ${Math.round(piece.engagement)} | ${piece.sourceName || piece.source || "unknown"} | ${text.slice(0, 220)} | ${piece.url ?? ""}`;
}

function topExampleUrl(pieces: CompetitorContentRecord[]): string | undefined {
  return pieces.find((piece) => piece.url)?.url;
}

export function heuristicBrandContentSummary(
  impact: CompetitorContentImpact
): BrandContentSummary | null {
  if (impact.positive.length === 0 && impact.negative.length === 0) {
    return null;
  }

  const summarizeSide = (pieces: CompetitorContentRecord[], empty: string): string => {
    if (pieces.length === 0) {
      return empty;
    }
    const sources = [...new Set(pieces.map((piece) => piece.sourceName || piece.source).filter(Boolean))];
    const lead = (pieces[0]?.title || pieces[0]?.snippet || "top posts")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120);
    return `${sources.join(", ") || "Social"} posts led this side. Highest engagement: ${lead}.`;
  };

  return {
    positive: summarizeSide(impact.positive, "No positively performing content in this window."),
    negative: summarizeSide(impact.negative, "No negatively performing content in this window."),
    positiveExampleUrl: topExampleUrl(impact.positive),
    negativeExampleUrl: topExampleUrl(impact.negative)
  };
}

export async function summarizeBrandContent(
  impact: CompetitorContentImpact
): Promise<BrandContentSummary | null> {
  if (impact.positive.length === 0 && impact.negative.length === 0) {
    return null;
  }

  const fallback = heuristicBrandContentSummary(impact);
  if (!isWorkExtractionAiConfigured()) {
    return fallback;
  }

  const systemPrompt = [
    "You summarize Masters' Union social/earned content performance for a comms team.",
    "Return STRICT JSON only: { \"positive\": string, \"negative\": string }.",
    "Each string is 1-3 short sentences. No bullet lists of captions. No hashtags.",
    "Positive: what content formats/themes actually worked (engagement, campus energy, events, student stories).",
    "Negative: what underperformed or read negative. If items are MU's own educational posts (investing, risk, startups) classified negative because of topic language, say they underperformed or were tagged negative due to topic — do not treat them as a brand crisis.",
    "Ignore filler, hashtag spam, and unrelated mentions."
  ].join(" ");

  const userPrompt = [
    `Window: ${impact.range.from} to ${impact.range.to} (${impact.timezone})`,
    "",
    "Positive pieces:",
    impact.positive.length > 0 ? impact.positive.map(pieceLine).join("\n") : "(none)",
    "",
    "Negative pieces:",
    impact.negative.length > 0 ? impact.negative.map(pieceLine).join("\n") : "(none)"
  ].join("\n");

  try {
    const raw = await callWorkLlm(systemPrompt, userPrompt);
    const parsed = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, "").trim()) as {
      positive?: unknown;
      negative?: unknown;
    };
    const positive = typeof parsed.positive === "string" ? parsed.positive.trim() : "";
    const negative = typeof parsed.negative === "string" ? parsed.negative.trim() : "";
    if (!positive && !negative) {
      return fallback;
    }
    return {
      positive: positive || fallback?.positive || "No positively performing content in this window.",
      negative: negative || fallback?.negative || "No negatively performing content in this window.",
      positiveExampleUrl: fallback?.positiveExampleUrl,
      negativeExampleUrl: fallback?.negativeExampleUrl
    };
  } catch (error) {
    console.warn("[sentiment.summary] LLM summary failed; using heuristic", {
      error: error instanceof Error ? error.message : String(error)
    });
    return fallback;
  }
}

export function formatBrandContentSummary(
  summary: BrandContentSummary,
  rangeLabel: string
): string {
  const lines = [
    `*What worked for MU — ${rangeLabel}*`,
    "",
    "*Positive*",
    summary.positive
  ];
  if (summary.positiveExampleUrl) {
    lines.push(`<${summary.positiveExampleUrl}|Example>`);
  }
  lines.push("", "*Negative*", summary.negative);
  if (summary.negativeExampleUrl) {
    lines.push(`<${summary.negativeExampleUrl}|Example>`);
  }
  return lines.join("\n");
}
