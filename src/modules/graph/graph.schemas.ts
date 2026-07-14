import { z } from "zod";

import { BRAIN_EDGE_TYPES, BRAIN_NODE_TYPES, DEFAULT_LIMIT_MEETINGS } from "./graph.constants";

export const brainGraphQuerySchema = z.object({
  from: z.string().datetime({ offset: true }).or(z.string().date()).optional(),
  to: z.string().datetime({ offset: true }).or(z.string().date()).optional(),
  limitMeetings: z.coerce.number().int().min(1).max(100).optional().default(DEFAULT_LIMIT_MEETINGS),
  includeSteps: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .optional()
    .transform((v) => {
      if (v === undefined) return false;
      if (typeof v === "boolean") return v;
      return v === "true";
    })
});

export type BrainGraphQuery = z.infer<typeof brainGraphQuerySchema>;

export const brainNodeSchema = z.object({
  id: z.string().min(1),
  type: z.enum(BRAIN_NODE_TYPES),
  label: z.string().min(1),
  val: z.number().optional(),
  meta: z.record(z.string(), z.unknown()).optional()
});

export const brainEdgeSchema = z.object({
  id: z.string().min(1).optional(),
  source: z.string().min(1),
  target: z.string().min(1),
  type: z.string().min(1),
  weight: z.number().optional(),
  label: z.string().optional()
});

export const aiEnrichmentSchema = z.object({
  nodes: z
    .array(
      z.object({
        id: z.string().min(1),
        type: z.enum(["theme", "collaboration", "idea"]),
        label: z.string().min(1),
        sourceMeetingIds: z.array(z.string()).optional(),
        memberIds: z.array(z.string()).optional(),
        memberNames: z.array(z.string()).optional()
      })
    )
    .default([]),
  edges: z
    .array(
      z.object({
        source: z.string().min(1),
        target: z.string().min(1),
        type: z.enum(BRAIN_EDGE_TYPES).or(z.string()),
        weight: z.number().optional(),
        label: z.string().optional()
      })
    )
    .default([])
});

export type AiEnrichment = z.infer<typeof aiEnrichmentSchema>;

export interface BrainNode {
  id: string;
  type: (typeof BRAIN_NODE_TYPES)[number];
  label: string;
  val: number;
  meta: Record<string, unknown>;
}

export interface BrainEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  weight?: number;
  label?: string;
}

export interface BrainGraphPayload {
  generatedAt: string;
  cached: boolean;
  nodes: BrainNode[];
  edges: BrainEdge[];
}
