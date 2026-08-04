import { z } from "zod";

import { PREREAD_NODE_KINDS } from "./preread.constants";

export const createPrereadSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional()
});

export const updatePrereadSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).nullable().optional()
});

export const replaceMembersSchema = z.object({
  members: z.array(
    z.object({
      userId: z.string().uuid(),
      role: z.enum(["viewer", "editor"]).default("viewer")
    })
  )
});

export const createNodeSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(10000).optional(),
  kind: z.enum(PREREAD_NODE_KINDS).optional(),
  parentId: z.string().uuid().nullable().optional(),
  orderIndex: z.number().int().min(0).optional()
});

export const updateNodeSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(10000).nullable().optional(),
  kind: z.enum(PREREAD_NODE_KINDS).optional(),
  parentId: z.string().uuid().nullable().optional(),
  orderIndex: z.number().int().min(0).optional()
});

export const createCommentSchema = z.object({
  body: z.string().min(1).max(5000)
});
