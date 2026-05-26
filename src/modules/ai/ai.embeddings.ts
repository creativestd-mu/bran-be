import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";

import { env } from "../../config/env";
import { upsertVectors, queryVectors } from "./ai.pinecone";

let anthropicClient: Anthropic | null = null;
let geminiClient: GoogleGenerativeAI | null = null;

function getAnthropic(): Anthropic {
  if (!anthropicClient) {
    if (!env.anthropicApiKey) {
      throw new Error("ANTHROPIC_API_KEY is not configured");
    }
    anthropicClient = new Anthropic({ apiKey: env.anthropicApiKey });
  }
  return anthropicClient;
}

function getGemini(): GoogleGenerativeAI {
  if (!geminiClient) {
    if (!env.geminiApiKey) {
      throw new Error("GEMINI_API_KEY is not configured");
    }
    geminiClient = new GoogleGenerativeAI(env.geminiApiKey);
  }
  return geminiClient;
}

type AiProvider = "anthropic" | "gemini";

function getAiProvider(): AiProvider {
  const provider = env.aiProvider.toLowerCase();
  return provider === "gemini" ? "gemini" : "anthropic";
}

const EMBEDDING_DIMENSION = 1024;

/**
 * Generate a simple hash-based embedding for text.
 * For production, replace with a proper embedding model (e.g. OpenAI text-embedding-3-small).
 * This is a deterministic placeholder that enables the Pinecone pipeline to work end-to-end.
 */
export function generateSimpleEmbedding(text: string): number[] {
  const vec = new Array<number>(EMBEDDING_DIMENSION).fill(0);
  const normalized = text.toLowerCase();

  for (let i = 0; i < normalized.length; i++) {
    const charCode = normalized.charCodeAt(i);
    const idx = (charCode * (i + 1)) % EMBEDDING_DIMENSION;
    vec[idx] += 1;
  }

  const magnitude = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0)) || 1;
  return vec.map((val) => val / magnitude);
}

export async function embedAndUpsertTask(task: {
  id: string;
  userId: string;
  userName: string;
  title: string;
  description?: string | null;
  type: string;
  platform?: string | null;
  status: string;
  createdAt: Date;
}) {
  const textToEmbed = [
    `Task: ${task.title}`,
    task.description ? `Description: ${task.description}` : "",
    `Type: ${task.type}`,
    task.platform ? `Platform: ${task.platform}` : "",
    `Status: ${task.status}`,
    `User: ${task.userName}`,
    `Date: ${task.createdAt.toISOString().split("T")[0]}`
  ]
    .filter(Boolean)
    .join(". ");

  const values = generateSimpleEmbedding(textToEmbed);

  await upsertVectors("tasks", [
    {
      id: task.id,
      values,
      metadata: {
        userId: task.userId,
        userName: task.userName,
        title: task.title,
        type: task.type,
        platform: task.platform ?? "",
        status: task.status,
        week: getIsoWeek(task.createdAt),
        createdAt: task.createdAt.toISOString()
      }
    }
  ]);
}

export async function semanticSearchTasks(
  query: string,
  filters?: { userId?: string; from?: string; to?: string },
  topK: number = 10
) {
  const vector = generateSimpleEmbedding(query);

  const filter: Record<string, unknown> = {};
  if (filters?.userId) {
    filter.userId = { $eq: filters.userId };
  }

  const results = await queryVectors("tasks", vector, topK, Object.keys(filter).length > 0 ? filter : undefined);
  return results.matches ?? [];
}

type IdeaEmbeddingInput = {
  id: string;
  authorId: string;
  authorName: string;
  title: string;
  description: string;
  tags?: string[];
  createdAt: Date;
};

type IdeaSearchInput = {
  title: string;
  description: string;
  tags?: string[];
  authorName?: string;
  createdAt?: Date;
};

function buildIdeaText(input: IdeaSearchInput): string {
  return [
    `Idea: ${input.title}`,
    `Description: ${input.description}`,
    input.tags && input.tags.length > 0 ? `Tags: ${input.tags.join(", ")}` : "",
    input.authorName ? `Author: ${input.authorName}` : "",
    input.createdAt ? `Date: ${input.createdAt.toISOString().split("T")[0]}` : ""
  ]
    .filter(Boolean)
    .join(". ");
}

export async function embedAndUpsertIdea(idea: IdeaEmbeddingInput) {
  const textToEmbed = buildIdeaText({
    title: idea.title,
    description: idea.description,
    tags: idea.tags,
    authorName: idea.authorName,
    createdAt: idea.createdAt
  });
  const values = generateSimpleEmbedding(textToEmbed);

  await upsertVectors("ideas", [
    {
      id: idea.id,
      values,
      metadata: {
        ideaId: idea.id,
        authorId: idea.authorId,
        authorName: idea.authorName,
        title: idea.title,
        description: idea.description,
        tags: (idea.tags ?? []).join(","),
        createdAt: idea.createdAt.toISOString()
      }
    }
  ]);
}

export async function semanticSearchIdeas(query: IdeaSearchInput | string, topK: number = 25) {
  const textToEmbed =
    typeof query === "string"
      ? query
      : buildIdeaText({
          title: query.title,
          description: query.description,
          tags: query.tags,
          authorName: query.authorName,
          createdAt: query.createdAt
        });

  const vector = generateSimpleEmbedding(textToEmbed);
  const results = await queryVectors("ideas", vector, topK);
  return results.matches ?? [];
}

export async function generatePerformanceReport(context: {
  userName: string;
  query: string;
  tasks: Array<{
    title: string;
    type: string;
    platform?: string | null;
    status: string;
    contentUrl?: string | null;
    metadata?: string | null;
    createdAt: Date;
    completedAt?: Date | null;
  }>;
  stats?: {
    totalTasks: number;
    completed: number;
    inProgress: number;
    pending: number;
    byPlatform: Record<string, number>;
  };
  socialStats?: Array<{
    source: string;
    engagement: number;
    estimatedViews: number;
    estimatedReach: number;
  }>;
  semanticContext?: Array<{ title: string; type: string; platform: string }>;
}) {
  const tasksList = context.tasks
    .map(
      (t) =>
        `- [${t.status}] "${t.title}" (${t.type}${t.platform ? `, ${t.platform}` : ""}) created ${t.createdAt.toISOString().split("T")[0]}${t.completedAt ? `, completed ${t.completedAt.toISOString().split("T")[0]}` : ""}${t.contentUrl ? ` | URL: ${t.contentUrl}` : ""}${formatInstagramTaskStats(t.metadata)}`
    )
    .join("\n");

  const statsSection = context.stats
    ? `
Task Statistics:
- Total: ${context.stats.totalTasks}
- Completed: ${context.stats.completed}
- In Progress: ${context.stats.inProgress}
- Pending: ${context.stats.pending}
- By Platform: ${Object.entries(context.stats.byPlatform).map(([k, v]) => `${k}: ${v}`).join(", ") || "N/A"}`
    : "";

  const socialSection =
    context.socialStats && context.socialStats.length > 0
      ? `
Content Performance (from social media):
${context.socialStats.map((s) => `- ${s.source}: ${s.estimatedViews} views, ${s.estimatedReach} reach, ${s.engagement} engagement`).join("\n")}`
      : "";

  const systemPrompt =
    "You are a concise team performance analyst. Produce a short, scannable report (max ~200 words) with these sections in order: " +
    "1) **Summary** (1–2 sentences), 2) **Highlights** (bullet list of concrete accomplishments), " +
    "3) **Metrics** (bullet list of the key numbers), 4) **Concerns / Next Steps** (only if relevant). " +
    "Do not repeat the raw task list. Skip a section if there is nothing meaningful to say. Use markdown.";

  const userPrompt = `Query: "${context.query}"

Report for: ${context.userName}

Tasks:
${tasksList || "No tasks found for this period."}
${statsSection}
${socialSection}`;

  const provider = getAiProvider();
  if (provider === "gemini") {
    const model = getGemini().getGenerativeModel({
      model: env.geminiModel,
      systemInstruction: systemPrompt,
      generationConfig: { maxOutputTokens: 1024, temperature: 0.3 }
    });
    const result = await model.generateContent(userPrompt);
    return result.response.text() || "Unable to generate report.";
  }

  const response = await getAnthropic().messages.create({
    model: env.anthropicModel,
    max_tokens: 1024,
    temperature: 0.3,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }]
  });

  const textBlock = response.content.find((block) => block.type === "text");
  return textBlock?.text ?? "Unable to generate report.";
}

function formatInstagramTaskStats(metadata?: string | null): string {
  if (!metadata) {
    return "";
  }

  try {
    const parsed = JSON.parse(metadata) as {
      instagramStats?: {
        likes?: number | null;
        comments?: number | null;
        views?: number | null;
        plays?: number | null;
      };
    };

    const stats = parsed.instagramStats;
    if (!stats || typeof stats !== "object") {
      return "";
    }

    const parts: string[] = [];
    if (typeof stats.likes === "number") parts.push(`likes: ${stats.likes}`);
    if (typeof stats.comments === "number") parts.push(`comments: ${stats.comments}`);
    if (typeof stats.views === "number") parts.push(`views: ${stats.views}`);
    if (typeof stats.plays === "number") parts.push(`plays: ${stats.plays}`);

    return parts.length > 0 ? ` | Instagram stats (${parts.join(", ")})` : "";
  } catch {
    return "";
  }
}

function getIsoWeek(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum =
    1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}
