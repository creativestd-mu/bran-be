export const BRAIN_NODE_TYPES = [
  "member",
  "meeting",
  "work_unit",
  "work_step",
  "project",
  "idea",
  "theme",
  "collaboration"
] as const;
export type BrainNodeType = (typeof BRAIN_NODE_TYPES)[number];

export const BRAIN_EDGE_TYPES = [
  "organizes",
  "derived_from",
  "owned_by",
  "created_by",
  "assigned_to",
  "belongs_to",
  "member_of",
  "authored",
  "reports_to",
  "co_attended",
  "discusses",
  "relates_to",
  "collaborates_with",
  "similar_to",
  "suggested_collaborator"
] as const;
export type BrainEdgeType = (typeof BRAIN_EDGE_TYPES)[number];

/** Optional color hints for FE Obsidian-style rendering */
export const BRAIN_NODE_COLORS: Record<BrainNodeType, string> = {
  member: "#4C8BF5",
  meeting: "#9B6DFF",
  work_unit: "#F5A623",
  work_step: "#F7D060",
  project: "#3DDC97",
  idea: "#FF6BCB",
  theme: "#A0AEC0",
  collaboration: "#E2E8F0"
};

export const GRAPH_CACHE_TTL_MS = 15 * 60 * 1000;
export const DEFAULT_LIMIT_MEETINGS = 40;
export const DEFAULT_LIMIT_WORK_UNITS = 100;
export const TRANSCRIPT_EXCERPT_CHARS = 3000;

export function nodeId(type: BrainNodeType, entityId: string): string {
  return `${type}:${entityId}`;
}
