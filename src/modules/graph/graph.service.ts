import { ATTENDANCE_ADMIN_ROLES } from "../attendance/attendance.constants";
import type { BrainGraphQuery, BrainGraphPayload, BrainEdge, BrainNode } from "./graph.schemas";
import {
  buildBrainGraphCacheKey,
  getBrainGraphCache,
  invalidateBrainGraphCache,
  setBrainGraphCache
} from "./graph.cache";
import { enrichGraphWithAi, mergeAiEnrichment, packAiContext } from "./graph.ai";
import {
  loadActiveUsers,
  loadGraphEscalations,
  loadGraphMeetings,
  loadGraphWorkUnits,
  loadProjects,
  loadViewerIdeas
} from "./graph.repository";
import { applyNodeDegrees, buildStructuralGraph } from "./graph.structural";

export { invalidateBrainGraphCache };

function parseOptionalDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed;
}

function mergeEdges(structural: BrainEdge[], enrichment: BrainEdge[]): BrainEdge[] {
  const seen = new Set(structural.map((e) => e.id));
  const merged = [...structural];
  for (const edge of enrichment) {
    if (seen.has(edge.id)) continue;
    seen.add(edge.id);
    merged.push(edge);
  }
  return merged;
}

async function buildBrainGraph(
  viewerUserId: string,
  roleName: string,
  query: BrainGraphQuery
): Promise<Omit<BrainGraphPayload, "cached">> {
  const from = parseOptionalDate(query.from);
  const to = parseOptionalDate(query.to);
  const includeEscalations = ATTENDANCE_ADMIN_ROLES.has(roleName);

  const [users, projects, workUnits, { ideas, matches }, escalations] = await Promise.all([
    loadActiveUsers(),
    loadProjects(),
    loadGraphWorkUnits({
      viewerUserId,
      roleName,
      from,
      to
    }),
    loadViewerIdeas(viewerUserId),
    includeEscalations ? loadGraphEscalations({ from, to }) : Promise.resolve([])
  ]);

  const visibleRecordingIds = [
    ...new Set(
      workUnits
        .map((unit) => unit.audioRecordingId)
        .filter((id): id is string => Boolean(id))
    )
  ];

  const meetings = await loadGraphMeetings({
    viewerUserId,
    from,
    to,
    limit: query.limitMeetings,
    visibleRecordingIds
  });

  const structural = buildStructuralGraph({
    users,
    projects,
    meetings,
    workUnits,
    ideas,
    ideaMatches: matches,
    escalations,
    includeSteps: query.includeSteps
  });

  let nodes: BrainNode[] = structural.nodes;
  let edges: BrainEdge[] = structural.edges;

  try {
    const context = packAiContext({
      users,
      meetings,
      workUnits,
      projects: projects.map((p) => ({ id: p.id, name: p.name })),
      ideas,
      escalations
    });

    const enrichment = await enrichGraphWithAi(context);
    const merged = mergeAiEnrichment({
      enrichment,
      existingNodes: nodes,
      users
    });
    nodes = merged.nodes;
    edges = mergeEdges(edges, merged.edges);
  } catch (error) {
    console.error("[graph.service] AI enrichment failed; returning structural graph", error);
  }

  nodes = applyNodeDegrees(nodes, edges);

  return {
    generatedAt: new Date().toISOString(),
    nodes,
    edges
  };
}

export async function getBrainGraph(
  viewerUserId: string,
  roleName: string,
  query: BrainGraphQuery,
  options?: { forceRebuild?: boolean }
): Promise<BrainGraphPayload> {
  const includeEscalations = ATTENDANCE_ADMIN_ROLES.has(roleName);
  const cacheKey = buildBrainGraphCacheKey({
    userId: viewerUserId,
    from: query.from,
    to: query.to,
    limitMeetings: query.limitMeetings,
    includeSteps: query.includeSteps,
    includeEscalations
  });

  if (!options?.forceRebuild) {
    const cached = getBrainGraphCache(cacheKey);
    if (cached) {
      return { ...cached, cached: true };
    }
  }

  const payload = await buildBrainGraph(viewerUserId, roleName, query);
  setBrainGraphCache(cacheKey, payload);
  return { ...payload, cached: false };
}
