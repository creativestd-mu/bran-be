import type { PrereadMemberRole, PrereadNodeKind } from "@prisma/client";

import { prisma } from "../../lib/prisma";

const userSummarySelect = {
  id: true,
  name: true,
  email: true,
  avatarUrl: true,
  designation: true
} as const;

export async function findPrereadById(id: string) {
  return prisma.preread.findUnique({
    where: { id },
    include: {
      owner: { select: userSummarySelect },
      members: {
        include: { user: { select: userSummarySelect } }
      }
    }
  });
}

export async function listPrereadsForUser(userId: string) {
  return prisma.preread.findMany({
    where: {
      OR: [{ ownerId: userId }, { members: { some: { userId } } }]
    },
    include: {
      owner: { select: userSummarySelect },
      members: {
        include: { user: { select: userSummarySelect } }
      },
      _count: { select: { nodes: true } }
    },
    orderBy: { updatedAt: "desc" }
  });
}

export async function createPreread(params: {
  title: string;
  description?: string;
  ownerId: string;
}) {
  return prisma.preread.create({
    data: {
      title: params.title,
      description: params.description,
      ownerId: params.ownerId
    },
    include: {
      owner: { select: userSummarySelect },
      members: {
        include: { user: { select: userSummarySelect } }
      }
    }
  });
}

export async function updatePreread(
  id: string,
  data: { title?: string; description?: string | null }
) {
  return prisma.preread.update({
    where: { id },
    data,
    include: {
      owner: { select: userSummarySelect },
      members: {
        include: { user: { select: userSummarySelect } }
      }
    }
  });
}

export async function deletePreread(id: string) {
  return prisma.preread.delete({ where: { id } });
}

export async function replacePrereadMembers(
  prereadId: string,
  members: Array<{ userId: string; role: PrereadMemberRole }>
) {
  return prisma.$transaction(async (tx) => {
    await tx.prereadMember.deleteMany({ where: { prereadId } });
    if (members.length === 0) return [];

    await tx.prereadMember.createMany({
      data: members.map((member) => ({
        prereadId,
        userId: member.userId,
        role: member.role
      })),
      skipDuplicates: true
    });

    return tx.prereadMember.findMany({
      where: { prereadId },
      include: { user: { select: userSummarySelect } }
    });
  });
}

export async function findNodesByPrereadId(prereadId: string) {
  return prisma.prereadNode.findMany({
    where: { prereadId },
    include: {
      comments: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: userSummarySelect } }
      },
      media: {
        orderBy: { createdAt: "asc" },
        include: { uploadedBy: { select: userSummarySelect } }
      }
    },
    orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }]
  });
}

export async function findNodeById(nodeId: string) {
  return prisma.prereadNode.findUnique({
    where: { id: nodeId },
    include: {
      comments: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: userSummarySelect } }
      },
      media: {
        orderBy: { createdAt: "asc" },
        include: { uploadedBy: { select: userSummarySelect } }
      }
    }
  });
}

export async function createNode(params: {
  prereadId: string;
  title: string;
  description?: string;
  kind?: PrereadNodeKind;
  parentId?: string | null;
  orderIndex?: number;
}) {
  return prisma.prereadNode.create({
    data: {
      prereadId: params.prereadId,
      title: params.title,
      description: params.description,
      kind: params.kind ?? "output",
      parentId: params.parentId ?? null,
      orderIndex: params.orderIndex ?? 0
    },
    include: {
      comments: {
        include: { author: { select: userSummarySelect } }
      },
      media: {
        include: { uploadedBy: { select: userSummarySelect } }
      }
    }
  });
}

export async function updateNode(
  nodeId: string,
  data: {
    title?: string;
    description?: string | null;
    kind?: PrereadNodeKind;
    parentId?: string | null;
    orderIndex?: number;
  }
) {
  return prisma.prereadNode.update({
    where: { id: nodeId },
    data,
    include: {
      comments: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: userSummarySelect } }
      },
      media: {
        orderBy: { createdAt: "asc" },
        include: { uploadedBy: { select: userSummarySelect } }
      }
    }
  });
}

export async function deleteNode(nodeId: string) {
  return prisma.prereadNode.delete({ where: { id: nodeId } });
}

export async function listComments(nodeId: string) {
  return prisma.prereadComment.findMany({
    where: { nodeId },
    orderBy: { createdAt: "asc" },
    include: { author: { select: userSummarySelect } }
  });
}

export async function createComment(params: {
  nodeId: string;
  authorId: string;
  body: string;
}) {
  return prisma.prereadComment.create({
    data: params,
    include: { author: { select: userSummarySelect } }
  });
}

export async function findCommentById(commentId: string) {
  return prisma.prereadComment.findUnique({
    where: { id: commentId },
    include: {
      node: { select: { prereadId: true } },
      author: { select: userSummarySelect }
    }
  });
}

export async function deleteComment(commentId: string) {
  return prisma.prereadComment.delete({ where: { id: commentId } });
}

export async function createMedia(params: {
  nodeId: string;
  uploadedById: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
}) {
  return prisma.prereadMedia.create({
    data: params,
    include: { uploadedBy: { select: userSummarySelect } }
  });
}

export async function findMediaById(mediaId: string) {
  return prisma.prereadMedia.findUnique({
    where: { id: mediaId },
    include: {
      node: { select: { prereadId: true } }
    }
  });
}

export async function deleteMedia(mediaId: string) {
  return prisma.prereadMedia.delete({ where: { id: mediaId } });
}

export async function findChildNodeIds(nodeId: string): Promise<string[]> {
  const children = await prisma.prereadNode.findMany({
    where: { parentId: nodeId },
    select: { id: true }
  });
  return children.map((child) => child.id);
}

export async function findValidUserIds(userIds: string[]) {
  if (userIds.length === 0) return [];
  return prisma.user.findMany({
    where: { id: { in: userIds }, isActive: true, isPlaceholder: false },
    select: { id: true }
  });
}
