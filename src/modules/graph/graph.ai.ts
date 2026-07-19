import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";

import { env } from "../../config/env";
import { BRAIN_NODE_COLORS, TRANSCRIPT_EXCERPT_CHARS, nodeId } from "./graph.constants";
import {
  aiEnrichmentSchema,
  type AiEnrichment,
  type BrainEdge,
  type BrainNode
} from "./graph.schemas";

let anthropicClient: Anthropic | null = null;
let geminiClient: GoogleGenerativeAI | null = null;

function getAnthropic(): Anthropic {
  if (!anthropicClient) {
    if (!env.anthropicApiKey) {
      throw new Error("ANTHROPIC_API_KEY is not configured");
    }
    anthropicClient = new Anthropic({ apiKey: env.anthropicApiKey });
  }
  return anthropicClient;
}

function getGemini(): GoogleGenerativeAI {
  if (!geminiClient) {
    if (!env.geminiApiKey) {
      throw new Error("GEMINI_API_KEY is not configured");
    }
    geminiClient = new GoogleGenerativeAI(env.geminiApiKey);
  }
  return geminiClient;
}

function getAiProvider(): "anthropic" | "gemini" {
  return env.aiProvider.toLowerCase() === "gemini" ? "gemini" : "anthropic";
}

function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

async function callLlm(systemPrompt: string, userPrompt: string): Promise<string> {
  const provider = getAiProvider();

  if (provider === "gemini") {
    const model = getGemini().getGenerativeModel({
      model: env.geminiModel,
      systemInstruction: systemPrompt,
      generationConfig: { maxOutputTokens: 4096, temperature: 0.2 }
    });
    const result = await model.generateContent(userPrompt);
    return result.response.text() || "";
  }

  const response = await getAnthropic().messages.create({
    model: env.anthropicModel,
    max_tokens: 4096,
    temperature: 0.2,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }]
  });

  const textBlock = response.content.find((block) => block.type === "text");
  return textBlock?.text ?? "";
}

export type GraphAiContext = {
  users: Array<{ id: string; name: string }>;
  meetings: Array<{
    id: string;
    title: string | null;
    startTime: string | null;
    organizerId: string;
    transcriptExcerpt: string | null;
  }>;
  workUnits: Array<{
    id: string;
    title: string;
    context: string;
    ownerId: string;
    projectId: string | null;
    audioRecordingId: string | null;
    assigneeSpokenName: string | null;
    stepAssignees: string[];
  }>;
  projects: Array<{ id: string; name: string }>;
  ideas: Array<{ id: string; title: string }>;
  escalations: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    summary: string | null;
    blockers: string | null;
    reporterName: string | null;
    context: string | null;
  }>;
};

function truncate(text: string | null | undefined, max = TRANSCRIPT_EXCERPT_CHARS): string | null {
  if (!text) return null;
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

export function packAiContext(input: {
  users: Array<{ id: string; name: string }>;
  meetings: Array<{
    id: string;
    title: string | null;
    startTime: Date | null;
    organizerUserId: string;
    voiceRecording: { transcript: string | null } | null;
  }>;
  workUnits: Array<{
    id: string;
    title: string;
    context: string;
    userId: string;
    projectId: string | null;
    audioRecordingId: string | null;
    assigneeSpokenName: string | null;
    steps: Array<{ assignee: { name: string } | null; assigneeSpokenName: string | null }>;
  }>;
  projects: Array<{ id: string; name: string }>;
  ideas: Array<{ id: string; title: string }>;
  escalations?: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    aiSummary: string | null;
    aiBlockers: string | null;
    reporterName: string | null;
    latestContext: string;
    problemContext: string;
  }>;
}): GraphAiContext {
  return {
    users: input.users.map((u) => ({ id: u.id, name: u.name })),
    meetings: input.meetings.map((m) => ({
      id: m.id,
      title: m.title,
      startTime: m.startTime?.toISOString() ?? null,
      organizerId: m.organizerUserId,
      transcriptExcerpt: truncate(m.voiceRecording?.transcript)
    })),
    workUnits: input.workUnits.map((w) => ({
      id: w.id,
      title: w.title,
      context: truncate(w.context, 500) ?? "",
      ownerId: w.userId,
      projectId: w.projectId,
      audioRecordingId: w.audioRecordingId,
      assigneeSpokenName: w.assigneeSpokenName,
      stepAssignees: w.steps
        .map((s) => s.assignee?.name ?? s.assigneeSpokenName)
        .filter((name): name is string => Boolean(name))
    })),
    projects: input.projects,
    ideas: input.ideas,
    escalations: (input.escalations ?? []).map((e) => ({
      id: e.id,
      title: e.title,
      status: e.status,
      priority: e.priority,
      summary: truncate(e.aiSummary, 500),
      blockers: truncate(e.aiBlockers, 500),
      reporterName: e.reporterName,
      context: truncate(e.latestContext || e.problemContext, 500)
    }))
  };
}

function resolveMemberRef(
  ref: string,
  users: Array<{ id: string; name: string }>
): string | null {
  if (ref.startsWith("member:")) {
    const id = ref.slice("member:".length);
    return users.some((u) => u.id === id) ? ref : null;
  }

  const byId = users.find((u) => u.id === ref);
  if (byId) return nodeId("member", byId.id);

  const normalized = ref.trim().toLowerCase();
  const byName = users.find((u) => u.name.toLowerCase() === normalized);
  if (byName) return nodeId("member", byName.id);

  const byPartial = users.find(
    (u) =>
      u.name.toLowerCase().includes(normalized) ||
      normalized.includes(u.name.toLowerCase().split(/\s+/)[0] ?? "")
  );
  if (byPartial) return nodeId("member", byPartial.id);

  return null;
}

function normalizeEndpoint(
  ref: string,
  knownNodeIds: Set<string>,
  users: Array<{ id: string; name: string }>
): string | null {
  if (knownNodeIds.has(ref)) return ref;

  if (
    ref.startsWith("meeting:") ||
    ref.startsWith("work_unit:") ||
    ref.startsWith("project:") ||
    ref.startsWith("idea:") ||
    ref.startsWith("theme:") ||
    ref.startsWith("collaboration:") ||
    ref.startsWith("escalation:")
  ) {
    if (knownNodeIds.has(ref)) return ref;
    if (ref.startsWith("theme:") || ref.startsWith("collaboration:")) return ref;
    return null;
  }

  return resolveMemberRef(ref, users);
}

export function mergeAiEnrichment(params: {
  enrichment: AiEnrichment;
  existingNodes: BrainNode[];
  users: Array<{ id: string; name: string }>;
}): { nodes: BrainNode[]; edges: BrainEdge[] } {
  const nodeMap = new Map(params.existingNodes.map((n) => [n.id, n]));
  const edges: BrainEdge[] = [];
  const seen = new Set<string>();

  for (const raw of params.enrichment.nodes) {
    let id = raw.id;
    if (raw.type === "theme" && !id.startsWith("theme:")) {
      id = `theme:${id.replace(/^theme:/, "").replace(/\s+/g, "-").toLowerCase()}`;
    }
    if (raw.type === "collaboration" && !id.startsWith("collaboration:")) {
      id = `collaboration:${id.replace(/^collaboration:/, "")}`;
    }
    if (raw.type === "idea" && !id.startsWith("idea:")) {
      // AI-invented ideas become theme-like idea nodes with synthetic ids
      id = `idea:ai-${id.replace(/^idea:/, "").replace(/\s+/g, "-").toLowerCase()}`;
    }

    const type = raw.type === "idea" ? "idea" : raw.type;
    if (!nodeMap.has(id)) {
      nodeMap.set(id, {
        id,
        type,
        label: raw.label,
        val: 1,
        meta: {
          color: BRAIN_NODE_COLORS[type],
          sourceMeetingIds: raw.sourceMeetingIds ?? [],
          memberIds: raw.memberIds ?? [],
          aiGenerated: true
        }
      });
    }

    // Link collaboration hubs to members
    const memberRefs = [
      ...(raw.memberIds ?? []),
      ...(raw.memberNames ?? []).map((name) => name)
    ];
    for (const ref of memberRefs) {
      const memberNode = resolveMemberRef(ref, params.users);
      if (!memberNode) continue;
      const edgeId = `collaborates_with:${id}->${memberNode}`;
      if (seen.has(edgeId)) continue;
      seen.add(edgeId);
      edges.push({
        id: edgeId,
        source: id,
        target: memberNode,
        type: "collaborates_with",
        weight: 0.7
      });
    }

    for (const meetingId of raw.sourceMeetingIds ?? []) {
      const meetingNode = meetingId.startsWith("meeting:")
        ? meetingId
        : nodeId("meeting", meetingId);
      if (!nodeMap.has(meetingNode) && !params.existingNodes.some((n) => n.id === meetingNode)) {
        continue;
      }
      const edgeId = `discusses:${meetingNode}->${id}`;
      if (seen.has(edgeId)) continue;
      seen.add(edgeId);
      edges.push({
        id: edgeId,
        source: meetingNode,
        target: id,
        type: "discusses",
        weight: 0.8
      });
    }
  }

  const knownIds = new Set(nodeMap.keys());

  for (const raw of params.enrichment.edges) {
    const source = normalizeEndpoint(raw.source, knownIds, params.users);
    const target = normalizeEndpoint(raw.target, knownIds, params.users);
    if (!source || !target) continue;
    if (!knownIds.has(source) || !knownIds.has(target)) continue;

    const edgeId = `${raw.type}:${source}->${target}`;
    if (seen.has(edgeId)) continue;
    seen.add(edgeId);
    edges.push({
      id: edgeId,
      source,
      target,
      type: raw.type,
      weight: raw.weight,
      label: raw.label
    });
  }

  return {
    nodes: [...nodeMap.values()],
    edges
  };
}

export async function enrichGraphWithAi(context: GraphAiContext): Promise<AiEnrichment> {
  if (
    context.meetings.length === 0 &&
    context.workUnits.length === 0 &&
    context.escalations.length === 0
  ) {
    return { nodes: [], edges: [] };
  }

  const systemPrompt =
    "You enrich a team collaboration brain map from meeting transcripts, work items, and escalations. " +
    "Return STRICT JSON only (no markdown) with shape: " +
    '{ "nodes": [ { "id": string, "type": "theme"|"collaboration"|"idea", "label": string, "sourceMeetingIds": string[], "memberIds": string[], "memberNames": string[] } ], ' +
    '"edges": [ { "source": string, "target": string, "type": "discusses"|"relates_to"|"collaborates_with"|"co_attended"|"similar_to"|"blocks", "weight": number, "label": string|null } ] }. ' +
    "Rules: Do NOT re-emit existing members/meetings/work_units/projects/escalations as nodes — only NEW theme, collaboration, or idea nodes. " +
    "Node ids: theme:<slug>, collaboration:<short-id>, idea:<slug>. " +
    "Edge endpoints must use prefixed ids (member:<uuid>, meeting:<uuid>, work_unit:<uuid>, project:<uuid>, idea:<uuid>, theme:<slug>, collaboration:<id>, escalation:<uuid>) " +
    "or exact member names from the users list. " +
    "When escalations are present, link them with relates_to or blocks to relevant theme/meeting/work_unit/project/member/idea nodes using escalation:<uuid>. " +
    "Do not invent escalation nodes. Prefer 5–25 enrichment nodes and 10–60 edges. Focus on themes discussed, collaborations between people, latent ideas, and escalation impact. " +
    "weight is 0–1. Use only people from the provided users list.";

  const userPrompt = `Build enrichment for this Bran team graph context:\n${JSON.stringify(context)}`;

  const raw = await callLlm(systemPrompt, userPrompt);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFences(raw));
  } catch (error) {
    console.error("[graph.ai] LLM returned non-JSON", {
      rawPreview: raw.slice(0, 500),
      error: error instanceof Error ? error.message : String(error)
    });
    return { nodes: [], edges: [] };
  }

  const validated = aiEnrichmentSchema.safeParse(parsed);
  if (!validated.success) {
    console.error("[graph.ai] LLM JSON failed schema validation", {
      issues: validated.error.flatten(),
      rawPreview: raw.slice(0, 500)
    });
    return { nodes: [], edges: [] };
  }

  return validated.data;
}
