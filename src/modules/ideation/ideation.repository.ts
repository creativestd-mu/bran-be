import { prisma } from "../../lib/prisma";

type CreateIdeaParams = {
  authorId: string;
  title: string;
  description: string;
  tags?: string[] | undefined;
};

type UpdateIdeaParams = {
  title?: string;
  description?: string;
  tags?: string[];
};

function serialiseTags(tags?: string[]): string | null {
  if (!tags || tags.length === 0) return null;
  return JSON.stringify(tags);
}

function parseTags(tags?: string | null): string[] {
  if (!tags) return [];
  try {
    const parsed = JSON.parse(tags) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === "string");
    }
  } catch {
    return tags
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
  }
  return [];
}

export async function createIdea(params: CreateIdeaParams) {
  const idea = await prisma.idea.create({
    data: {
      authorId: params.authorId,
      title: params.title,
      description: params.description,
      tags: serialiseTags(params.tags)
    },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          email: true,
          designation: true,
          avatarUrl: true
        }
      }
    }
  });

  return { ...idea, tagsList: parseTags(idea.tags) };
}

export async function listIdeasByAuthor(authorId: string, options?: { take?: number; skip?: number }) {
  const ideas = await prisma.idea.findMany({
    where: { authorId },
    orderBy: { createdAt: "desc" },
    take: options?.take ?? 50,
    skip: options?.skip ?? 0
  });
  return ideas.map((idea) => ({ ...idea, tagsList: parseTags(idea.tags) }));
}

export async function updateIdeaByAuthor(
  ideaId: string,
  authorId: string,
  params: UpdateIdeaParams
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.idea.findFirst({
      where: { id: ideaId, authorId },
      select: { id: true }
    });
    if (!existing) return null;

    // Matches are derived from idea content. Remove both directions so edited
    // text cannot leave stale recommendations behind.
    await tx.ideaMatch.deleteMany({
      where: { OR: [{ ideaId }, { candidateIdeaId: ideaId }] }
    });

    const idea = await tx.idea.update({
      where: { id: ideaId },
      data: {
        ...(params.title !== undefined ? { title: params.title } : {}),
        ...(params.description !== undefined ? { description: params.description } : {}),
        ...(params.tags !== undefined ? { tags: serialiseTags(params.tags) } : {})
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            designation: true,
            avatarUrl: true
          }
        }
      }
    });

    return { ...idea, tagsList: parseTags(idea.tags) };
  });
}

export async function deleteIdeaByAuthor(ideaId: string, authorId: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.idea.findFirst({
      where: { id: ideaId, authorId },
      select: { id: true }
    });
    if (!existing) return false;

    // candidateIdea uses NoAction, so remove derived matches explicitly.
    await tx.ideaMatch.deleteMany({
      where: { OR: [{ ideaId }, { candidateIdeaId: ideaId }] }
    });
    await tx.idea.delete({ where: { id: ideaId } });
    return true;
  });
}

export async function upsertIdeaMatch(params: {
  ideaId: string;
  candidateIdeaId: string;
  matchedUserId: string;
  score: number;
  status?: string;
  notifiedAt?: Date;
}) {
  return prisma.ideaMatch.upsert({
    where: {
      ideaId_candidateIdeaId_matchedUserId: {
        ideaId: params.ideaId,
        candidateIdeaId: params.candidateIdeaId,
        matchedUserId: params.matchedUserId
      }
    },
    update: {
      score: params.score,
      status: params.status ?? "SUGGESTED",
      notifiedAt: params.notifiedAt
    },
    create: {
      ideaId: params.ideaId,
      candidateIdeaId: params.candidateIdeaId,
      matchedUserId: params.matchedUserId,
      score: params.score,
      status: params.status ?? "SUGGESTED",
      notifiedAt: params.notifiedAt
    }
  });
}

export async function listRecommendationsForUser(userId: string, options?: { take?: number; skip?: number }) {
  return prisma.ideaMatch.findMany({
    where: { idea: { authorId: userId } },
    include: {
      idea: {
        select: {
          id: true,
          title: true,
          description: true,
          createdAt: true,
          tags: true
        }
      },
      candidateIdea: {
        select: {
          id: true,
          title: true,
          description: true,
          createdAt: true,
          tags: true
        }
      },
      matchedUser: {
        select: {
          id: true,
          name: true,
          email: true,
          designation: true,
          avatarUrl: true
        }
      }
    },
    orderBy: [{ score: "desc" }, { createdAt: "desc" }],
    take: options?.take ?? 20,
    skip: options?.skip ?? 0
  });
}

export function deserializeTagsForApi(tags?: string | null): string[] {
  return parseTags(tags);
}
