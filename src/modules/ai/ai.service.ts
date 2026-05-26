import { prisma } from "../../lib/prisma";
import { HttpError } from "../../utils/httpError";
import { findTasksByUserAndDateRange } from "../tasks/tasks.repository";
import {
  semanticSearchTasks,
  generatePerformanceReport,
  embedAndUpsertTask
} from "./ai.embeddings";

interface QueryIntent {
  userName: string | null;
  userId: string | null;
  scope: "user" | "team";
  timeRange: { from: Date; to: Date };
}

// ────────────────────────────────────────────────────────────────────────────
// User cache (60s) — avoids hitting the DB on every query just to match a name
// ────────────────────────────────────────────────────────────────────────────

interface CachedUser {
  id: string;
  name: string;
  email: string;
}

let userCache: { at: number; users: CachedUser[] } | null = null;
const USER_CACHE_TTL_MS = 60_000;

async function getActiveUsers(): Promise<CachedUser[]> {
  const now = Date.now();
  if (userCache && now - userCache.at < USER_CACHE_TTL_MS) {
    return userCache.users;
  }

  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true, email: true }
  });

  userCache = { at: now, users };
  return users;
}

// ────────────────────────────────────────────────────────────────────────────
// Time-range parsing
// ────────────────────────────────────────────────────────────────────────────

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function parseTimeRange(query: string): { from: Date; to: Date } {
  const now = new Date();
  const lower = query.toLowerCase();

  // "past/last N days|weeks|months"
  const pastN = lower.match(/\b(?:past|last|previous)\s+(\d{1,3})\s*(day|days|week|weeks|month|months)\b/);
  if (pastN) {
    const n = Math.max(1, Math.min(365, Number.parseInt(pastN[1], 10)));
    const unit = pastN[2];
    const from = new Date(now);
    if (unit.startsWith("day")) from.setDate(now.getDate() - n);
    else if (unit.startsWith("week")) from.setDate(now.getDate() - n * 7);
    else from.setMonth(now.getMonth() - n);
    return { from: startOfDay(from), to: endOfDay(now) };
  }

  if (/\b(this|current)\s+week\b/.test(lower)) {
    const dayOfWeek = now.getDay();
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const from = new Date(now);
    from.setDate(now.getDate() - diffToMonday);
    return { from: startOfDay(from), to: endOfDay(now) };
  }

  if (/\blast\s+week\b/.test(lower)) {
    const dayOfWeek = now.getDay();
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const from = new Date(now);
    from.setDate(now.getDate() - diffToMonday - 7);
    const to = new Date(from);
    to.setDate(from.getDate() + 6);
    return { from: startOfDay(from), to: endOfDay(to) };
  }

  if (/\b(this|current)\s+month\b/.test(lower)) {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: startOfDay(from), to: endOfDay(now) };
  }

  if (/\blast\s+month\b/.test(lower)) {
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const to = new Date(now.getFullYear(), now.getMonth(), 0);
    return { from: startOfDay(from), to: endOfDay(to) };
  }

  if (/\b(this|current)\s+(quarter|qtr)\b/.test(lower)) {
    const q = Math.floor(now.getMonth() / 3);
    const from = new Date(now.getFullYear(), q * 3, 1);
    return { from: startOfDay(from), to: endOfDay(now) };
  }

  if (/\b(this|current)\s+year\b/.test(lower)) {
    const from = new Date(now.getFullYear(), 0, 1);
    return { from: startOfDay(from), to: endOfDay(now) };
  }

  if (/\byesterday\b/.test(lower)) {
    const from = new Date(now);
    from.setDate(now.getDate() - 1);
    return { from: startOfDay(from), to: endOfDay(from) };
  }

  if (/\btoday\b/.test(lower)) {
    return { from: startOfDay(now), to: endOfDay(now) };
  }

  // Default: trailing 7 days
  const from = new Date(now);
  from.setDate(now.getDate() - 7);
  return { from: startOfDay(from), to: endOfDay(now) };
}

// ────────────────────────────────────────────────────────────────────────────
// Name extraction — matches against real user names from the DB
// ────────────────────────────────────────────────────────────────────────────

const TEAM_KEYWORDS = /\b(team|everyone|everybody|all\s+(?:users|members|staff|people)|whole\s+team|entire\s+team)\b/i;

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function tokenize(s: string): string[] {
  return normalize(s).split(" ").filter(Boolean);
}

interface NameMatch {
  user: CachedUser;
  score: number;
}

/**
 * Score how well a user's name matches the query.
 * Higher score wins. We reward:
 *  - full-name substring matches (strongest signal)
 *  - multi-token matches (first + last name both present)
 *  - first-name token match (weakest, but common conversational style)
 */
function scoreUserAgainstQuery(user: CachedUser, queryTokens: Set<string>, normalizedQuery: string): number {
  const fullNameNorm = normalize(user.name);
  if (!fullNameNorm) return 0;

  // Strongest: full name appears verbatim in the query
  if (fullNameNorm.length >= 3 && normalizedQuery.includes(fullNameNorm)) {
    return 100 + fullNameNorm.length;
  }

  const nameTokens = fullNameNorm.split(" ").filter((t) => t.length >= 2);
  if (nameTokens.length === 0) return 0;

  let matched = 0;
  let totalLen = 0;
  for (const t of nameTokens) {
    if (queryTokens.has(t)) {
      matched += 1;
      totalLen += t.length;
    }
  }

  if (matched === 0) return 0;

  // All name tokens matched (e.g. first + last)
  if (matched === nameTokens.length && nameTokens.length > 1) {
    return 80 + totalLen;
  }

  // Single-token match — only count if the matched token is reasonably distinctive
  // (avoid matching common words; queryTokens already excludes these via stop-word filter)
  if (matched >= 1) {
    return 40 + totalLen;
  }

  return 0;
}

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "of", "for", "to", "in", "on", "at", "by",
  "with", "from", "about", "as", "is", "are", "was", "were", "be", "been", "being",
  "do", "did", "does", "doing", "done", "have", "has", "had", "having",
  "this", "that", "these", "those", "what", "how", "when", "where", "who", "why", "which",
  "show", "tell", "give", "get", "find", "list", "report", "summary", "summarize",
  "performance", "tasks", "task", "work", "progress", "update", "updates",
  "week", "weeks", "month", "months", "day", "days", "year", "years", "today", "yesterday",
  "team", "everyone", "everybody", "all", "members", "people", "staff",
  "instagram", "youtube", "facebook", "linkedin", "social", "media", "platform",
  "me", "you", "us", "we", "they", "them", "i", "my", "our", "their",
  "please", "can", "could", "would", "should", "make", "made", "do", "doing",
  "post", "posts", "content", "video", "videos", "reel", "reels", "story", "stories"
]);

function resolveUserFromQuery(query: string, users: CachedUser[]): CachedUser | null {
  const normalizedQuery = normalize(query);
  const queryTokens = new Set(
    tokenize(query).filter((t) => t.length >= 2 && !STOP_WORDS.has(t))
  );

  if (queryTokens.size === 0 && !normalizedQuery) return null;

  let best: NameMatch | null = null;
  for (const user of users) {
    const score = scoreUserAgainstQuery(user, queryTokens, normalizedQuery);
    if (score > 0 && (!best || score > best.score)) {
      best = { user, score };
    }
  }

  return best?.user ?? null;
}

function parseQueryIntent(query: string, users: CachedUser[]): QueryIntent {
  const timeRange = parseTimeRange(query);

  if (TEAM_KEYWORDS.test(query)) {
    return { userName: null, userId: null, scope: "team", timeRange };
  }

  const user = resolveUserFromQuery(query, users);
  if (user) {
    return { userName: user.name, userId: user.id, scope: "user", timeRange };
  }

  return { userName: null, userId: null, scope: "user", timeRange };
}

// ────────────────────────────────────────────────────────────────────────────
// Main entry point
// ────────────────────────────────────────────────────────────────────────────

const MAX_TASKS_FOR_LLM = 40;

export async function processAiQuery(query: string) {
  const users = await getActiveUsers();
  const intent = parseQueryIntent(query, users);

  if (intent.scope === "user" && !intent.userId) {
    const sample = users.slice(0, 5).map((u) => u.name).join(", ");
    throw new HttpError(
      400,
      `Could not identify a person in your query. Mention a name (e.g. "${sample || "Neha"}") or ask about the "team".`
    );
  }

  const userIds =
    intent.scope === "team" ? users.map((u) => u.id) : [intent.userId as string];
  const displayName =
    intent.scope === "team" ? "Team" : (intent.userName as string);

  // Fan out all I/O in parallel — this is the biggest win for latency.
  const [tasksByUser, socialStats, semanticContext] = await Promise.all([
    fetchTasksForUsers(userIds, intent.timeRange.from, intent.timeRange.to),
    fetchSocialStats(intent.timeRange.from, intent.timeRange.to),
    fetchSemanticContext(query, intent.scope === "user" ? (intent.userId as string) : undefined)
  ]);

  const tasks = tasksByUser.flat();
  const stats = computeStats(tasks);

  const report = await generatePerformanceReport({
    userName: displayName,
    query,
    tasks: tasks.slice(0, MAX_TASKS_FOR_LLM).map((t) => ({
      title: t.title,
      type: t.type,
      platform: t.platform,
      status: t.status,
      contentUrl: t.contentUrl,
      metadata: t.metadata,
      createdAt: t.createdAt,
      completedAt: t.completedAt
    })),
    stats,
    socialStats,
    semanticContext
  });

  return {
    report,
    meta: {
      user:
        intent.scope === "user"
          ? { id: intent.userId, name: intent.userName }
          : { id: null, name: "team", memberCount: users.length },
      scope: intent.scope,
      timeRange: intent.timeRange,
      taskCount: tasks.length,
      hadSemanticContext: semanticContext.length > 0,
      truncatedTasks: tasks.length > MAX_TASKS_FOR_LLM
    }
  };
}

async function fetchTasksForUsers(userIds: string[], from: Date, to: Date) {
  // Cap fan-out so a "team" query against a huge org doesn't issue hundreds
  // of parallel queries — most teams will be small enough that this is a no-op.
  const CONCURRENCY = 8;
  const results: Awaited<ReturnType<typeof findTasksByUserAndDateRange>>[] = [];
  for (let i = 0; i < userIds.length; i += CONCURRENCY) {
    const batch = userIds.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map((id) => findTasksByUserAndDateRange(id, from, to))
    );
    results.push(...batchResults);
  }
  return results;
}

async function fetchSocialStats(from: Date, to: Date) {
  return prisma.instagramPerformance.findMany({
    where: { mentionedAt: { gte: from, lte: to } },
    select: {
      source: true,
      engagement: true,
      estimatedViews: true,
      estimatedReach: true
    }
  });
}

async function fetchSemanticContext(
  query: string,
  userId?: string
): Promise<Array<{ title: string; type: string; platform: string }>> {
  try {
    const matches = await semanticSearchTasks(query, userId ? { userId } : undefined, 5);
    return matches
      .filter((m) => m.metadata)
      .map((m) => ({
        title: String(m.metadata!.title ?? ""),
        type: String(m.metadata!.type ?? ""),
        platform: String(m.metadata!.platform ?? "")
      }));
  } catch {
    // Pinecone may not be configured / reachable; degrade gracefully.
    return [];
  }
}

function computeStats(tasks: Array<{ status: string; platform?: string | null }>) {
  const stats = {
    totalTasks: tasks.length,
    completed: 0,
    inProgress: 0,
    pending: 0,
    byPlatform: {} as Record<string, number>
  };

  for (const t of tasks) {
    if (t.status === "COMPLETED") stats.completed += 1;
    else if (t.status === "IN_PROGRESS") stats.inProgress += 1;
    else if (t.status === "PENDING") stats.pending += 1;

    if (t.platform) {
      stats.byPlatform[t.platform] = (stats.byPlatform[t.platform] || 0) + 1;
    }
  }

  return stats;
}

export async function indexTaskForSearch(taskId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { user: { select: { id: true, name: true } } }
  });

  if (!task) return;

  try {
    await embedAndUpsertTask({
      id: task.id,
      userId: task.userId,
      userName: task.user.name,
      title: task.title,
      description: task.description,
      type: task.type,
      platform: task.platform,
      status: task.status,
      createdAt: task.createdAt
    });
  } catch (err) {
    console.error("[ai-index] Failed to index task:", taskId, err);
  }
}

// Exported for tests / cache invalidation hooks
export function _invalidateUserCache() {
  userCache = null;
}
