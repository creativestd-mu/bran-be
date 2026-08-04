import path from "node:path";

import type { PrereadMemberRole, PrereadNodeKind } from "@prisma/client";

import {
  deleteStoredFile,
  openStoredFileReadStream,
  saveStoredFile
} from "../../lib/file-storage";
import { HttpError } from "../../utils/httpError";
import { isImageMime } from "./preread.constants";
import * as repo from "./preread.repository";

type UserSummary = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  designation: string | null;
};

export type PrereadAccess = "owner" | "editor" | "viewer";

export interface PrereadTreeNode {
  id: string;
  prereadId: string;
  parentId: string | null;
  title: string;
  description: string | null;
  kind: PrereadNodeKind;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
  comments: Array<{
    id: string;
    nodeId: string;
    body: string;
    createdAt: string;
    author: UserSummary;
  }>;
  media: Array<{
    id: string;
    nodeId: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    mediaType: "image" | "video";
    createdAt: string;
    uploadedBy: UserSummary;
  }>;
  children: PrereadTreeNode[];
}

function serializeUser(user: UserSummary) {
  return user;
}

function serializeMedia(
  media: Awaited<ReturnType<typeof repo.findNodeById>> extends infer N
    ? N extends { media: infer M }
      ? M extends Array<infer Item>
        ? Item
        : never
      : never
    : never
) {
  return {
    id: media.id,
    nodeId: media.nodeId,
    filename: media.filename,
    mimeType: media.mimeType,
    sizeBytes: media.sizeBytes,
    mediaType: (isImageMime(media.mimeType) ? "image" : "video") as "image" | "video",
    createdAt: media.createdAt.toISOString(),
    uploadedBy: serializeUser(media.uploadedBy)
  };
}

function serializeComment(
  comment: Awaited<ReturnType<typeof repo.listComments>>[number]
) {
  return {
    id: comment.id,
    nodeId: comment.nodeId,
    body: comment.body,
    createdAt: comment.createdAt.toISOString(),
    author: serializeUser(comment.author)
  };
}

function serializeNodeFlat(
  node: Awaited<ReturnType<typeof repo.findNodesByPrereadId>>[number]
): Omit<PrereadTreeNode, "children"> {
  return {
    id: node.id,
    prereadId: node.prereadId,
    parentId: node.parentId,
    title: node.title,
    description: node.description,
    kind: node.kind,
    orderIndex: node.orderIndex,
    createdAt: node.createdAt.toISOString(),
    updatedAt: node.updatedAt.toISOString(),
    comments: node.comments.map(serializeComment),
    media: node.media.map(serializeMedia)
  };
}

function buildTree(nodes: Awaited<ReturnType<typeof repo.findNodesByPrereadId>>): PrereadTreeNode[] {
  const flat = nodes.map(serializeNodeFlat);
  const byId = new Map(flat.map((node) => [node.id, { ...node, children: [] as PrereadTreeNode[] }]));
  const roots: PrereadTreeNode[] = [];

  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortRecursive = (items: PrereadTreeNode[]) => {
    items.sort((a, b) => a.orderIndex - b.orderIndex || a.createdAt.localeCompare(b.createdAt));
    for (const item of items) sortRecursive(item.children);
  };
  sortRecursive(roots);
  return roots;
}

function getAccess(
  preread: { ownerId: string },
  userId: string,
  member: { role: PrereadMemberRole } | undefined
): PrereadAccess {
  if (preread.ownerId === userId) return "owner";
  if (member) return member.role;
  throw new HttpError(403, "You do not have access to this preread.");
}

async function loadPrereadOrThrow(prereadId: string) {
  const preread = await repo.findPrereadById(prereadId);
  if (!preread) throw new HttpError(404, "Preread not found.");
  return preread;
}

export async function assertCanAccess(prereadId: string, userId: string) {
  const preread = await loadPrereadOrThrow(prereadId);
  const member = preread.members.find((m) => m.userId === userId);
  if (preread.ownerId !== userId && !member) {
    throw new HttpError(403, "You do not have access to this preread.");
  }
  return { preread, access: getAccess(preread, userId, member) };
}

export async function assertIsOwner(prereadId: string, userId: string) {
  const { preread, access } = await assertCanAccess(prereadId, userId);
  if (access !== "owner") {
    throw new HttpError(403, "Only the preread owner can perform this action.");
  }
  return preread;
}

export async function assertCanEdit(prereadId: string, userId: string) {
  const { preread, access } = await assertCanAccess(prereadId, userId);
  if (access !== "owner" && access !== "editor") {
    throw new HttpError(403, "You need edit access to perform this action.");
  }
  return preread;
}

async function assertNodeInPreread(prereadId: string, nodeId: string) {
  const node = await repo.findNodeById(nodeId);
  if (!node || node.prereadId !== prereadId) {
    throw new HttpError(404, "Node not found.");
  }
  return node;
}

async function validateParent(prereadId: string, parentId: string | null | undefined, nodeId?: string) {
  if (!parentId) return;
  const parent = await repo.findNodeById(parentId);
  if (!parent || parent.prereadId !== prereadId) {
    throw new HttpError(400, "Invalid parent node.");
  }
  if (nodeId && parentId === nodeId) {
    throw new HttpError(400, "A node cannot be its own parent.");
  }
  if (nodeId) {
    let cursor: string | null = parentId;
    while (cursor) {
      if (cursor === nodeId) {
        throw new HttpError(400, "Cannot move a node under one of its descendants.");
      }
      const current = await repo.findNodeById(cursor);
      cursor = current?.parentId ?? null;
    }
  }
}

function serializePrereadSummary(
  preread: Awaited<ReturnType<typeof repo.listPrereadsForUser>>[number],
  userId: string
) {
  const member = preread.members.find((m) => m.userId === userId);
  return {
    id: preread.id,
    title: preread.title,
    description: preread.description,
    ownerId: preread.ownerId,
    owner: serializeUser(preread.owner),
    access: getAccess(preread, userId, member),
    memberCount: preread.members.length,
    nodeCount: preread._count.nodes,
    members: preread.members.map((m) => ({
      userId: m.userId,
      user: serializeUser(m.user),
      role: m.role,
      createdAt: m.createdAt.toISOString()
    })),
    createdAt: preread.createdAt.toISOString(),
    updatedAt: preread.updatedAt.toISOString()
  };
}

export async function listPrereads(userId: string) {
  const rows = await repo.listPrereadsForUser(userId);
  return rows.map((row) => serializePrereadSummary(row, userId));
}

export async function createPreread(userId: string, data: { title: string; description?: string }) {
  const preread = await repo.createPreread({
    title: data.title,
    description: data.description,
    ownerId: userId
  });
  return {
    ...serializePrereadSummary({ ...preread, _count: { nodes: 0 } }, userId),
    tree: [] as PrereadTreeNode[]
  };
}

export async function getPrereadDetail(prereadId: string, userId: string) {
  const { preread, access } = await assertCanAccess(prereadId, userId);
  const nodes = await repo.findNodesByPrereadId(prereadId);
  return {
    id: preread.id,
    title: preread.title,
    description: preread.description,
    ownerId: preread.ownerId,
    owner: serializeUser(preread.owner),
    access,
    members: preread.members.map((member) => ({
      userId: member.userId,
      user: serializeUser(member.user),
      role: member.role,
      createdAt: member.createdAt.toISOString()
    })),
    tree: buildTree(nodes),
    createdAt: preread.createdAt.toISOString(),
    updatedAt: preread.updatedAt.toISOString()
  };
}

export async function updatePreread(
  prereadId: string,
  userId: string,
  data: { title?: string; description?: string | null }
) {
  await assertCanEdit(prereadId, userId);
  await repo.updatePreread(prereadId, data);
  return getPrereadDetail(prereadId, userId);
}

export async function deletePreread(prereadId: string, userId: string) {
  await assertIsOwner(prereadId, userId);
  const nodes = await repo.findNodesByPrereadId(prereadId);
  await repo.deletePreread(prereadId);
  for (const node of nodes) {
    for (const media of node.media) {
      await deleteStoredFile("prereads", media.storagePath);
    }
  }
}

export async function replaceMembers(
  prereadId: string,
  userId: string,
  members: Array<{ userId: string; role: PrereadMemberRole }>
) {
  const preread = await assertIsOwner(prereadId, userId);
  const roleByUserId = new Map<string, PrereadMemberRole>();
  for (const entry of members) {
    if (entry.userId === preread.ownerId) continue;
    roleByUserId.set(entry.userId, entry.role);
  }
  const validUsers = await repo.findValidUserIds([...roleByUserId.keys()]);
  const validEntries = validUsers.map((user) => ({
    userId: user.id,
    role: roleByUserId.get(user.id)!
  }));
  const saved = await repo.replacePrereadMembers(prereadId, validEntries);
  return saved.map((member) => ({
    userId: member.userId,
    user: serializeUser(member.user),
    role: member.role,
    createdAt: member.createdAt.toISOString()
  }));
}

export async function createNode(
  prereadId: string,
  userId: string,
  data: {
    title: string;
    description?: string;
    kind?: PrereadNodeKind;
    parentId?: string | null;
    orderIndex?: number;
  }
) {
  await assertCanEdit(prereadId, userId);
  await validateParent(prereadId, data.parentId);
  const node = await repo.createNode({
    prereadId,
    title: data.title,
    description: data.description,
    kind: data.kind,
    parentId: data.parentId,
    orderIndex: data.orderIndex
  });
  return serializeNodeFlat({ ...node, comments: node.comments, media: node.media });
}

export async function updateNode(
  prereadId: string,
  nodeId: string,
  userId: string,
  data: {
    title?: string;
    description?: string | null;
    kind?: PrereadNodeKind;
    parentId?: string | null;
    orderIndex?: number;
  }
) {
  await assertCanEdit(prereadId, userId);
  await assertNodeInPreread(prereadId, nodeId);
  if (data.parentId !== undefined) {
    await validateParent(prereadId, data.parentId, nodeId);
  }
  const node = await repo.updateNode(nodeId, data);
  return serializeNodeFlat(node);
}

async function collectDescendantMedia(
  nodeId: string
): Promise<Array<{ storagePath: string }>> {
  const node = await repo.findNodeById(nodeId);
  if (!node) return [];

  const children = await repo.findChildNodeIds(nodeId);
  const descendantMedia = await Promise.all(children.map((child) => collectDescendantMedia(child)));

  return [...node.media, ...descendantMedia.flat()];
}

export async function deleteNode(prereadId: string, nodeId: string, userId: string) {
  await assertCanEdit(prereadId, userId);
  await assertNodeInPreread(prereadId, nodeId);
  // The node's children cascade-delete in the DB, but their media files on
  // disk/S3 must be cleaned up explicitly, so collect the whole subtree first.
  const media = await collectDescendantMedia(nodeId);
  await repo.deleteNode(nodeId);
  for (const item of media) {
    await deleteStoredFile("prereads", item.storagePath);
  }
}

export async function listNodeComments(prereadId: string, nodeId: string, userId: string) {
  await assertCanAccess(prereadId, userId);
  await assertNodeInPreread(prereadId, nodeId);
  const comments = await repo.listComments(nodeId);
  return comments.map(serializeComment);
}

export async function createNodeComment(
  prereadId: string,
  nodeId: string,
  userId: string,
  body: string
) {
  await assertCanAccess(prereadId, userId);
  await assertNodeInPreread(prereadId, nodeId);
  const comment = await repo.createComment({ nodeId, authorId: userId, body });
  return serializeComment(comment);
}

export async function deleteNodeComment(
  prereadId: string,
  nodeId: string,
  commentId: string,
  userId: string
) {
  const { access } = await assertCanAccess(prereadId, userId);
  await assertNodeInPreread(prereadId, nodeId);
  const comment = await repo.findCommentById(commentId);
  if (!comment || comment.nodeId !== nodeId) {
    throw new HttpError(404, "Comment not found.");
  }
  if (access === "viewer" && comment.authorId !== userId) {
    throw new HttpError(403, "You can only delete your own comments.");
  }
  await repo.deleteComment(commentId);
}

export async function uploadNodeMedia(
  prereadId: string,
  nodeId: string,
  userId: string,
  file: Express.Multer.File
) {
  await assertCanEdit(prereadId, userId);
  await assertNodeInPreread(prereadId, nodeId);

  const mediaId = crypto.randomUUID();
  const safeName = path.basename(file.originalname).replace(/[^\w.\-()+ ]/g, "_");
  const storagePath = `${prereadId}/${nodeId}/${mediaId}-${safeName}`;

  await saveStoredFile({
    root: "prereads",
    relativePath: storagePath,
    buffer: file.buffer,
    contentType: file.mimetype
  });

  const media = await repo.createMedia({
    nodeId,
    uploadedById: userId,
    filename: safeName,
    mimeType: file.mimetype,
    sizeBytes: file.size,
    storagePath
  });

  return serializeMedia(media);
}

export async function resolveNodeMediaStream(
  prereadId: string,
  nodeId: string,
  mediaId: string,
  userId: string
) {
  await assertCanAccess(prereadId, userId);
  await assertNodeInPreread(prereadId, nodeId);
  const media = await repo.findMediaById(mediaId);
  if (!media || media.nodeId !== nodeId) {
    throw new HttpError(404, "Media not found.");
  }
  const stream = await openStoredFileReadStream("prereads", media.storagePath);
  return { media, stream };
}

export async function deleteNodeMedia(
  prereadId: string,
  nodeId: string,
  mediaId: string,
  userId: string
) {
  await assertCanEdit(prereadId, userId);
  await assertNodeInPreread(prereadId, nodeId);
  const media = await repo.findMediaById(mediaId);
  if (!media || media.nodeId !== nodeId) {
    throw new HttpError(404, "Media not found.");
  }
  await deleteStoredFile("prereads", media.storagePath);
  await repo.deleteMedia(mediaId);
}
