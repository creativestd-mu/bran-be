import {
  createIdeaAndRecommendations,
  listMyRecommendations,
  rankCollaboratorCandidates
} from "../../../src/modules/ideation/ideation.service";
import {
  createIdea,
  listRecommendationsForUser,
  upsertIdeaMatch
} from "../../../src/modules/ideation/ideation.repository";
import { semanticSearchIdeas, embedAndUpsertIdea } from "../../../src/modules/ai/ai.embeddings";
import { notifyIdeaCollaboratorMatch } from "../../../src/modules/notifications/notifications.service";

jest.mock("../../../src/modules/ideation/ideation.repository", () => ({
  createIdea: jest.fn(),
  listIdeasByAuthor: jest.fn(),
  listRecommendationsForUser: jest.fn(),
  upsertIdeaMatch: jest.fn(),
  deserializeTagsForApi: (value: string | null | undefined) => {
    if (!value) return [];
    try {
      return JSON.parse(value) as string[];
    } catch {
      return [];
    }
  }
}));

jest.mock("../../../src/modules/ai/ai.embeddings", () => ({
  embedAndUpsertIdea: jest.fn(),
  semanticSearchIdeas: jest.fn()
}));

jest.mock("../../../src/modules/notifications/notifications.service", () => ({
  notifyIdeaCollaboratorMatch: jest.fn()
}));

const createIdeaMock = createIdea as jest.MockedFunction<typeof createIdea>;
const upsertIdeaMatchMock = upsertIdeaMatch as jest.MockedFunction<typeof upsertIdeaMatch>;
const semanticSearchIdeasMock = semanticSearchIdeas as jest.MockedFunction<typeof semanticSearchIdeas>;
const embedAndUpsertIdeaMock = embedAndUpsertIdea as jest.MockedFunction<typeof embedAndUpsertIdea>;
const notifyIdeaCollaboratorMatchMock =
  notifyIdeaCollaboratorMatch as jest.MockedFunction<typeof notifyIdeaCollaboratorMatch>;
const listRecommendationsForUserMock =
  listRecommendationsForUser as jest.MockedFunction<typeof listRecommendationsForUser>;

describe("ideation.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("ranks unique collaborators, excluding self and low-score matches", () => {
    const ranked = rankCollaboratorCandidates("u-1", "idea-1", [
      {
        id: "idea-1",
        score: 0.99,
        metadata: { ideaId: "idea-1", authorId: "u-1", createdAt: new Date().toISOString() }
      },
      {
        id: "idea-2",
        score: 0.8,
        metadata: { ideaId: "idea-2", authorId: "u-2", createdAt: new Date().toISOString() }
      },
      {
        id: "idea-3",
        score: 0.2,
        metadata: { ideaId: "idea-3", authorId: "u-3", createdAt: new Date().toISOString() }
      },
      {
        id: "idea-4",
        score: 0.7,
        metadata: {
          ideaId: "idea-4",
          authorId: "u-2",
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 90).toISOString()
        }
      }
    ]);

    expect(ranked).toHaveLength(1);
    expect(ranked[0].matchedUserId).toBe("u-2");
    expect(ranked[0].candidateIdeaId).toBe("idea-2");
  });

  it("creates idea, saves matches, and notifies both users on high score", async () => {
    const now = new Date();
    createIdeaMock.mockResolvedValue({
      id: "idea-1",
      authorId: "u-1",
      title: "AI newsletter generator",
      description: "Build an AI-driven workflow for newsletter ideation",
      tags: JSON.stringify(["ai", "newsletter"]),
      createdAt: now,
      updatedAt: now,
      tagsList: ["ai", "newsletter"],
      author: {
        id: "u-1",
        name: "Ada",
        email: "ada@bran.app",
        designation: "PM",
        avatarUrl: null
      }
    });
    semanticSearchIdeasMock.mockResolvedValue([
      {
        id: "idea-2",
        score: 0.9,
        metadata: {
          ideaId: "idea-2",
          authorId: "u-2",
          createdAt: now.toISOString()
        }
      },
      {
        id: "idea-3",
        score: 0.65,
        metadata: {
          ideaId: "idea-3",
          authorId: "u-3",
          createdAt: now.toISOString()
        }
      }
    ]);

    await createIdeaAndRecommendations({
      userId: "u-1",
      title: "AI newsletter generator",
      description: "Build an AI-driven workflow for newsletter ideation",
      tags: ["ai", "newsletter"]
    });

    expect(embedAndUpsertIdeaMock).toHaveBeenCalledTimes(1);
    expect(upsertIdeaMatchMock).toHaveBeenCalledTimes(2);
    expect(notifyIdeaCollaboratorMatchMock).toHaveBeenCalledTimes(1);
    expect(notifyIdeaCollaboratorMatchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceIdea: expect.objectContaining({ id: "idea-1" }),
        matchedUserId: "u-2"
      })
    );
  });

  it("returns safe recommendation payloads", async () => {
    const now = new Date();
    listRecommendationsForUserMock.mockResolvedValue([
      {
        id: "m-1",
        ideaId: "idea-1",
        candidateIdeaId: "idea-2",
        matchedUserId: "u-2",
        score: 0.88,
        status: "NOTIFIED",
        notifiedAt: now,
        createdAt: now,
        updatedAt: now,
        idea: {
          id: "idea-1",
          title: "AI newsletter generator",
          description: "source idea",
          createdAt: now,
          tags: JSON.stringify(["ai"])
        },
        candidateIdea: {
          id: "idea-2",
          title: "Automated topic finder",
          description: "candidate idea",
          createdAt: now,
          tags: JSON.stringify(["automation"])
        },
        matchedUser: {
          id: "u-2",
          name: "Ben",
          email: "ben@bran.app",
          designation: "Designer",
          avatarUrl: null
        }
      }
    ]);

    const result = await listMyRecommendations({ userId: "u-1" });
    expect(result).toEqual([
      expect.objectContaining({
        id: "m-1",
        score: 0.88,
        sourceIdea: expect.objectContaining({ tags: ["ai"] }),
        matchedIdea: expect.objectContaining({ tags: ["automation"] }),
        matchedUser: expect.objectContaining({ id: "u-2", name: "Ben" })
      })
    ]);
  });
});
