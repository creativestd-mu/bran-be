import { env } from "../../config/env";
import { notifyIdeaCollaboratorMatch } from "../notifications/notifications.service";
import { embedAndUpsertIdea, semanticSearchIdeas } from "../ai/ai.embeddings";
import {
  createIdea,
  deserializeTagsForApi,
  listIdeasByAuthor,
  listRecommendationsForUser,
  upsertIdeaMatch
} from "./ideation.repository";

type IdeaSearchMatch = {
  id: string;
  score?: number;
  metadata?: {
    ideaId?: string;
    authorId?: string;
    title?: string;
    description?: string;
    createdAt?: string;
    [key: string]: unknown;
  };
};

type RankedCandidate = {
  matchedUserId: string;
  candidateIdeaId: string;
  score: number;
};

function ageInDays(isoDate: string): number {
  const createdAt = new Date(isoDate);
  if (Number.isNaN(createdAt.getTime())) return 0;
  const ms = Date.now() - createdAt.getTime();
  return Math.max(0, ms / (1000 * 60 * 60 * 24));
}

export function rankCollaboratorCandidates(
  sourceAuthorId: string,
  sourceIdeaId: string,
  matches: IdeaSearchMatch[],
  options?: {
    minScore?: number;
    maxRecommendations?: number;
  }
): RankedCandidate[] {
  const minScore = options?.minScore ?? env.ideaMatchThreshold;
  const maxRecommendations = options?.maxRecommendations ?? env.ideaMatchMaxRecommendations;
  const byUser = new Map<string, RankedCandidate>();

  for (const match of matches) {
    const metadata = match.metadata;
    const candidateIdeaId = metadata?.ideaId;
    const matchedUserId = metadata?.authorId;
    const score = match.score ?? 0;
    if (!candidateIdeaId || !matchedUserId) continue;
    if (candidateIdeaId === sourceIdeaId) continue;
    if (matchedUserId === sourceAuthorId) continue;
    if (score < minScore) continue;

    const createdAt = typeof metadata.createdAt === "string" ? metadata.createdAt : "";
    const days = createdAt ? ageInDays(createdAt) : 0;
    const recencyWeight = 1 / (1 + days / 30);
    const weightedScore = score * recencyWeight;

    const existing = byUser.get(matchedUserId);
    if (!existing || weightedScore > existing.score) {
      byUser.set(matchedUserId, {
        matchedUserId,
        candidateIdeaId,
        score: Number(weightedScore.toFixed(6))
      });
    }
  }

  return Array.from(byUser.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, maxRecommendations);
}

export async function createIdeaAndRecommendations(params: {
  userId: string;
  title: string;
  description: string;
  tags?: string[];
}) {
  const created = await createIdea({
    authorId: params.userId,
    title: params.title,
    description: params.description,
    tags: params.tags
  });

  try {
    await embedAndUpsertIdea({
      id: created.id,
      authorId: created.authorId,
      authorName: created.author.name,
      title: created.title,
      description: created.description,
      tags: created.tagsList,
      createdAt: created.createdAt
    });

    const topK = env.ideaMatchTopK;
    const matches = await semanticSearchIdeas(
      {
        title: created.title,
        description: created.description,
        tags: created.tagsList,
        authorName: created.author.name,
        createdAt: created.createdAt
      },
      topK
    );

    const ranked = rankCollaboratorCandidates(created.authorId, created.id, matches);
    const notifyThreshold = env.ideaNotifyThreshold;
    const notifiedAt = new Date();

    for (const candidate of ranked) {
      await upsertIdeaMatch({
        ideaId: created.id,
        candidateIdeaId: candidate.candidateIdeaId,
        matchedUserId: candidate.matchedUserId,
        score: candidate.score,
        status: candidate.score >= notifyThreshold ? "NOTIFIED" : "SUGGESTED",
        notifiedAt: candidate.score >= notifyThreshold ? notifiedAt : undefined
      });

      if (candidate.score < notifyThreshold) continue;

      await notifyIdeaCollaboratorMatch({
        sourceIdea: {
          id: created.id,
          title: created.title,
          description: created.description,
          authorId: created.authorId
        },
        matchedIdea: {
          id: candidate.candidateIdeaId
        },
        sourceUser: {
          id: created.author.id,
          name: created.author.name,
          email: created.author.email
        },
        matchedUserId: candidate.matchedUserId,
        similarityScore: candidate.score
      });
    }
  } catch (error) {
    // Keep idea creation resilient even when external vector infrastructure is unavailable.
    console.error("[ideation] failed to generate recommendations", error);
  }

  return {
    id: created.id,
    title: created.title,
    description: created.description,
    tags: created.tagsList,
    createdAt: created.createdAt
  };
}

export async function listMyIdeas(params: { userId: string; take?: number; skip?: number }) {
  const ideas = await listIdeasByAuthor(params.userId, { take: params.take, skip: params.skip });
  return ideas.map((idea) => ({
    id: idea.id,
    title: idea.title,
    description: idea.description,
    tags: idea.tagsList,
    createdAt: idea.createdAt,
    updatedAt: idea.updatedAt
  }));
}

export async function listMyRecommendations(params: { userId: string; take?: number; skip?: number }) {
  const items = await listRecommendationsForUser(params.userId, { take: params.take, skip: params.skip });
  return items.map((item) => ({
    id: item.id,
    score: item.score,
    status: item.status,
    createdAt: item.createdAt,
    sourceIdea: {
      id: item.idea.id,
      title: item.idea.title,
      description: item.idea.description,
      tags: deserializeTagsForApi(item.idea.tags),
      createdAt: item.idea.createdAt
    },
    matchedIdea: {
      id: item.candidateIdea.id,
      title: item.candidateIdea.title,
      description: item.candidateIdea.description,
      tags: deserializeTagsForApi(item.candidateIdea.tags),
      createdAt: item.candidateIdea.createdAt
    },
    matchedUser: {
      id: item.matchedUser.id,
      name: item.matchedUser.name,
      email: item.matchedUser.email,
      designation: item.matchedUser.designation,
      avatarUrl: item.matchedUser.avatarUrl
    }
  }));
}
