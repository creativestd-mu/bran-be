import { prisma } from "../../lib/prisma";
import {
  DEFAULT_LIMIT_ESCALATIONS,
  DEFAULT_LIMIT_WORK_UNITS,
  ESCALATION_UPDATE_BODY_CHARS
} from "./graph.constants";

export async function loadActiveUsers() {
  return prisma.user.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      email: true,
      avatarUrl: true,
      designation: true,
      managerUserId: true
    },
    orderBy: { name: "asc" }
  });
}

export async function loadProjects() {
  return prisma.project.findMany({
    select: {
      id: true,
      name: true,
      status: true,
      members: {
        where: { isActive: true },
        select: { userId: true }
      }
    },
    orderBy: { name: "asc" },
    take: 100
  });
}

export async function loadViewerIdeas(viewerUserId: string) {
  const ideas = await prisma.idea.findMany({
    where: { authorId: viewerUserId },
    select: {
      id: true,
      title: true,
      description: true,
      authorId: true,
      createdAt: true
    },
    orderBy: { createdAt: "desc" },
    take: 50
  });

  const matches = await prisma.ideaMatch.findMany({
    where: {
      OR: [{ idea: { authorId: viewerUserId } }, { matchedUserId: viewerUserId }]
    },
    select: {
      id: true,
      ideaId: true,
      candidateIdeaId: true,
      matchedUserId: true,
      score: true,
      status: true
    },
    take: 100
  });

  return { ideas, matches };
}

export async function loadGraphMeetings(options: {
  viewerUserId: string;
  from?: Date;
  to?: Date;
  limit: number;
  visibleRecordingIds: string[];
}) {
  const dateFilter =
    options.from || options.to
      ? {
          ...(options.from ? { gte: options.from } : {}),
          ...(options.to ? { lte: options.to } : {})
        }
      : undefined;

  return prisma.meeting.findMany({
    where: {
      AND: [
        {
          OR: [
            { organizerUserId: options.viewerUserId },
            ...(options.visibleRecordingIds.length > 0
              ? [{ voiceRecordingId: { in: options.visibleRecordingIds } }]
              : [])
          ]
        },
        ...(dateFilter ? [{ startTime: dateFilter }] : [])
      ]
    },
    include: {
      voiceRecording: {
        select: { id: true, transcript: true, status: true }
      }
    },
    orderBy: { createdAt: "desc" },
    take: options.limit
  });
}

export async function loadGraphWorkUnits(options: {
  viewerUserId: string;
  roleName: string;
  from?: Date;
  to?: Date;
  limit?: number;
}) {
  const canViewAll =
    options.roleName === "admin" ||
    options.roleName === "manager" ||
    options.roleName === "superadmin";

  const dateFilter =
    options.from || options.to
      ? {
          ...(options.from ? { gte: options.from } : {}),
          ...(options.to ? { lte: options.to } : {})
        }
      : undefined;

  return prisma.workUnit.findMany({
    where: {
      AND: [
        canViewAll
          ? {
              OR: [
                { isPrivate: false },
                { userId: options.viewerUserId },
                { createdById: options.viewerUserId }
              ]
            }
          : {
              OR: [{ userId: options.viewerUserId }, { createdById: options.viewerUserId }]
            },
        ...(dateFilter ? [{ createdAt: dateFilter }] : [])
      ]
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      project: { select: { id: true, name: true, status: true } },
      steps: {
        select: {
          id: true,
          description: true,
          assigneeId: true,
          done: true,
          assigneeSpokenName: true,
          assignee: { select: { id: true, name: true } }
        }
      }
    },
    orderBy: { createdAt: "desc" },
    take: options.limit ?? DEFAULT_LIMIT_WORK_UNITS
  });
}

function truncateUpdateBody(body: string, max = ESCALATION_UPDATE_BODY_CHARS): string {
  if (body.length <= max) return body;
  return `${body.slice(0, max)}…`;
}

export async function loadGraphEscalations(options: {
  from?: Date;
  to?: Date;
  limit?: number;
}) {
  const dateFilter =
    options.from || options.to
      ? {
          OR: [
            {
              createdAt: {
                ...(options.from ? { gte: options.from } : {}),
                ...(options.to ? { lte: options.to } : {})
              }
            },
            {
              latestUpdateAt: {
                ...(options.from ? { gte: options.from } : {}),
                ...(options.to ? { lte: options.to } : {})
              }
            }
          ]
        }
      : undefined;

  const rows = await prisma.escalation.findMany({
    where: dateFilter,
    select: {
      id: true,
      title: true,
      problemContext: true,
      latestContext: true,
      status: true,
      priority: true,
      slackChannelId: true,
      slackMessageTs: true,
      reporterSlackId: true,
      reporterName: true,
      reporterEmail: true,
      latestUpdateAt: true,
      resolvedAt: true,
      aiSummary: true,
      aiIssueDescription: true,
      aiBlockers: true,
      aiAnalyzedAt: true,
      createdAt: true,
      updates: {
        select: {
          authorEmail: true,
          authorName: true,
          body: true,
          createdAt: true
        },
        orderBy: { createdAt: "asc" },
        take: 20
      }
    },
    orderBy: [
      { status: "asc" },
      { latestUpdateAt: "desc" },
      { createdAt: "desc" }
    ],
    take: options.limit ?? DEFAULT_LIMIT_ESCALATIONS
  });

  // Prefer active statuses while still keeping resolved/closed in the window.
  const activeRank = (status: string) => {
    if (status === "open" || status === "in_progress" || status === "waiting") return 0;
    if (status === "resolved") return 1;
    return 2;
  };

  return rows
    .slice()
    .sort((a, b) => {
      const rankDiff = activeRank(a.status) - activeRank(b.status);
      if (rankDiff !== 0) return rankDiff;
      const aTime = (a.latestUpdateAt ?? a.createdAt).getTime();
      const bTime = (b.latestUpdateAt ?? b.createdAt).getTime();
      return bTime - aTime;
    })
    .map((row) => ({
      ...row,
      updates: row.updates.map((update) => ({
        ...update,
        body: truncateUpdateBody(update.body)
      }))
    }));
}
