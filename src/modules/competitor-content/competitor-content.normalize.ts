import type { CompetitorContentRecord, CompetitorSentiment } from "./competitor-content.types";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
}

function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return 0;
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    const text = asString(value);
    if (text) {
      return text;
    }
  }
  return undefined;
}

function truncate(value: string | undefined, max = 400): string | undefined {
  if (!value) {
    return undefined;
  }
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max - 1).trimEnd()}…`;
}

function extractDocumentId(doc: Record<string, unknown>): string | undefined {
  const meta = asRecord(doc.meta) ?? asRecord(doc.metadata);
  const id =
    firstString(
      doc.id,
      doc.document_id,
      doc.doc_id,
      meta?.id,
      meta?.document_id,
      meta?.external_id,
      asRecord(doc.source)?.id
    ) ?? undefined;
  return id;
}

function extractPublishedAt(doc: Record<string, unknown>): string | undefined {
  const meta = asRecord(doc.meta) ?? asRecord(doc.metadata);
  const content = asRecord(doc.content);
  const raw = firstString(
    doc.published_date,
    doc.publishedAt,
    doc.date,
    doc.datetime,
    meta?.published_date,
    meta?.published_at,
    meta?.date,
    content?.published_date,
    content?.date
  );
  if (!raw) {
    return undefined;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }
  return parsed.toISOString();
}

function extractMetrics(doc: Record<string, unknown>): {
  engagement: number;
  reach: number;
  estimatedViews: number;
} {
  const metrics = asRecord(doc.metrics) ?? {};
  const sourceMetrics = asRecord(asRecord(doc.source)?.metrics) ?? {};
  const engagementMetrics = asRecord(metrics.engagement);
  const socialEchoMetrics = asRecord(metrics.social_echo);
  const engagement = asNumber(
    engagementMetrics?.total ??
      metrics.engagement ??
      socialEchoMetrics?.total ??
      metrics.social_echo ??
      doc.engagement ??
      doc.social_echo ??
      0
  );
  const reach = asNumber(
    sourceMetrics.reach ??
      sourceMetrics.global_reach ??
      metrics.reach ??
      doc.reach ??
      metrics.estimated_reach ??
      0
  );
  const estimatedViews = asNumber(
    metrics.estimated_views ??
      metrics.views ??
      doc.estimated_views ??
      doc.views ??
      0
  );
  return { engagement, reach, estimatedViews };
}

function normalizeSentiment(
  value: unknown,
  fallback: CompetitorSentiment
): CompetitorSentiment {
  const text = asString(value)?.toLowerCase();
  if (text === "positive" || text === "negative") {
    return text;
  }
  return fallback;
}

export type ContentRelevance = "competitor" | "brand";

const RELEVANT_COMPETITOR_RE =
  /\b(newton\s+school(?:\s+of\s+(?:technology|coding))?|newtonschool|scaler\s+(?:academy|school(?:\s+of\s+(?:business|technology))?)|scaler\.com|ashoka\s+university|ashoka\.edu|upgrad\s+(?:education|campus|abroad)|upgrad\.com|mesa\s+school\s+of\s+business|mesaschool)\b|@(?:newtonschool|scaler_official|ashokauniv|upgrad_edu|mesaschoolofbusiness)\b/i;

const RELEVANT_BRAND_RE =
  /\b(masters?\s*['’]?\s*union|mastersunion|mastersunion\.org)\b|#mastersunion|@mastersunion/i;

function normalizeForRelevance(value: string): string {
  return value.replace(/[_-]+/g, " ");
}

function relevanceCorpus(input: {
  title?: string;
  snippet?: string;
  url?: string;
  sourceName?: string;
  author?: string;
}): string {
  return [input.title, input.snippet, input.url, input.sourceName, input.author]
    .filter((value): value is string => Boolean(value))
    .map(normalizeForRelevance)
    .join(" ");
}

export function isRelevantCompetitorContent(input: {
  title?: string;
  snippet?: string;
  url?: string;
  sourceName?: string;
  author?: string;
}): boolean {
  return RELEVANT_COMPETITOR_RE.test(relevanceCorpus(input));
}

export function isRelevantBrandContent(input: {
  title?: string;
  snippet?: string;
  url?: string;
  sourceName?: string;
  author?: string;
}): boolean {
  return RELEVANT_BRAND_RE.test(relevanceCorpus(input));
}

function isRelevantDocument(
  doc: Record<string, unknown>,
  content: Record<string, unknown>,
  source: Record<string, unknown>,
  author: Record<string, unknown>,
  relevance: ContentRelevance
): boolean {
  const matched = asRecord(doc.matched) ?? {};
  const keywords = Array.isArray(matched.keywords)
    ? matched.keywords.map(asString).filter((value): value is string => Boolean(value))
    : [];
  const corpus = [
    content.title,
    content.headline,
    content.opening_text,
    content.body,
    doc.title,
    doc.url,
    source.domain,
    source.url,
    author.name,
    author.handle,
    matched.hit_sentence,
    ...keywords
  ]
    .map(asString)
    .filter((value): value is string => Boolean(value))
    .map(normalizeForRelevance)
    .join(" ");
  return relevance === "brand" ? RELEVANT_BRAND_RE.test(corpus) : RELEVANT_COMPETITOR_RE.test(corpus);
}

export function normalizeCompetitorDocuments(
  payload: unknown,
  meta: {
    searchId: string;
    searchName?: string;
    timezone: string;
    sentiment: CompetitorSentiment;
    relevance?: ContentRelevance;
  }
): CompetitorContentRecord[] {
  const root = asRecord(payload) ?? {};
  const result = asRecord(root.result) ?? root;
  const documents = Array.isArray(result.documents)
    ? result.documents
    : Array.isArray(root.documents)
      ? root.documents
      : [];

  const records: CompetitorContentRecord[] = [];

  for (const item of documents) {
    const doc = asRecord(item);
    if (!doc) {
      continue;
    }

    const documentId = extractDocumentId(doc);
    if (!documentId) {
      continue;
    }

    const content = asRecord(doc.content) ?? {};
    const source = asRecord(doc.source) ?? {};
    const author = asRecord(doc.author) ?? {};
    const metrics = extractMetrics(doc);

    // Saved-search definitions can still produce stemming/substring false positives.
    if (!isRelevantDocument(doc, content, source, author, meta.relevance ?? "competitor")) {
      continue;
    }

    // Skip zero-impact pieces — "don't force it"
    if (metrics.engagement <= 0 && metrics.reach <= 0 && metrics.estimatedViews <= 0) {
      continue;
    }

    const title = firstString(content.title, doc.title, content.headline);
    const body = firstString(content.body, content.opening_text, content.snippet, doc.body);
    const matched = asRecord(doc.matched) ?? {};
    const url = firstString(doc.url, content.url, source.url, content.matched_url);
    const sourceName = firstString(
      source.name,
      source.title,
      doc.source_name,
      asRecord(doc.outlet)?.name
    );
    const sourceType = firstString(source.type, doc.source_type, meta.searchName);
    const authorName = firstString(
      author.name,
      author.handle,
      author.external_id,
      asString(doc.author)
    );

    records.push({
      searchId: meta.searchId,
      searchName: meta.searchName,
      documentId,
      url,
      title,
      snippet: truncate(body ?? title),
      source: sourceType,
      sourceName,
      author: authorName,
      publishedAt: extractPublishedAt(doc),
      sentiment: normalizeSentiment(
        firstString(
          asRecord(doc.enrichments)?.sentiment,
          doc.sentiment,
          content.sentiment,
          asRecord(doc.enrichment)?.sentiment
        ),
        meta.sentiment
      ),
      engagement: metrics.engagement,
      reach: metrics.reach,
      estimatedViews: metrics.estimatedViews,
      timezone: meta.timezone,
      rawPayload: {
        ...doc,
        matchedKeywords: matched.keywords
      }
    });
  }

  return records;
}
