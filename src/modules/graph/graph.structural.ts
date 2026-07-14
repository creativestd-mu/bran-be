import {
  BRAIN_NODE_COLORS,
  nodeId,
  type BrainNodeType
} from "./graph.constants";
import type { BrainEdge, BrainNode } from "./graph.schemas";

type UserRow = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  designation: string | null;
  managerUserId: string | null;
};

type ProjectRow = {
  id: string;
  name: string;
  status: string;
  members: Array<{ userId: string }>;
};

type MeetingRow = {
  id: string;
  title: string | null;
  meetingUrl: string;
  startTime: Date | null;
  status: string;
  organizerUserId: string;
  voiceRecordingId: string | null;
  voiceRecording: { id: string; transcript: string | null; status: string } | null;
};

type WorkUnitRow = {
  id: string;
  title: string;
  context: string;
  status: string;
  userId: string;
  createdById: string | null;
  projectId: string | null;
  audioRecordingId: string | null;
  assigneeSpokenName: string | null;
  steps: Array<{
    id: string;
    description: string;
    assigneeId: string | null;
    done: boolean;
    assigneeSpokenName: string | null;
    assignee: { id: string; name: string } | null;
  }>;
};

type IdeaRow = {
  id: string;
  title: string;
  description: string;
  authorId: string;
};

type IdeaMatchRow = {
  id: string;
  ideaId: string;
  candidateIdeaId: string | null;
  matchedUserId: string | null;
  score: number;
};

function pushNode(
  map: Map<string, BrainNode>,
  type: BrainNodeType,
  entityId: string,
  label: string,
  meta: Record<string, unknown> = {}
) {
  const id = nodeId(type, entityId);
  if (map.has(id)) return;
  map.set(id, {
    id,
    type,
    label,
    val: 1,
    meta: {
      entityId,
      color: BRAIN_NODE_COLORS[type],
      ...meta
    }
  });
}

function pushEdge(
  edges: BrainEdge[],
  seen: Set<string>,
  source: string,
  target: string,
  type: string,
  extras?: { weight?: number; label?: string }
) {
  if (source === target) return;
  const id = `${type}:${source}->${target}`;
  if (seen.has(id)) return;
  seen.add(id);
  edges.push({
    id,
    source,
    target,
    type,
    weight: extras?.weight,
    label: extras?.label
  });
}

export function buildStructuralGraph(input: {
  users: UserRow[];
  projects: ProjectRow[];
  meetings: MeetingRow[];
  workUnits: WorkUnitRow[];
  ideas: IdeaRow[];
  ideaMatches: IdeaMatchRow[];
  includeSteps: boolean;
}): { nodes: BrainNode[]; edges: BrainEdge[] } {
  const nodeMap = new Map<string, BrainNode>();
  const edges: BrainEdge[] = [];
  const seenEdges = new Set<string>();

  for (const user of input.users) {
    pushNode(nodeMap, "member", user.id, user.name, {
      email: user.email,
      avatarUrl: user.avatarUrl,
      designation: user.designation
    });
  }

  for (const user of input.users) {
    if (!user.managerUserId) continue;
    const managerNode = nodeId("member", user.managerUserId);
    if (!nodeMap.has(managerNode)) continue;
    pushEdge(edges, seenEdges, nodeId("member", user.id), managerNode, "reports_to");
  }

  for (const project of input.projects) {
    pushNode(nodeMap, "project", project.id, project.name, { status: project.status });
    for (const member of project.members) {
      const memberNode = nodeId("member", member.userId);
      if (!nodeMap.has(memberNode)) continue;
      pushEdge(edges, seenEdges, memberNode, nodeId("project", project.id), "member_of");
    }
  }

  const recordingToMeeting = new Map<string, string>();
  for (const meeting of input.meetings) {
    pushNode(nodeMap, "meeting", meeting.id, meeting.title || meeting.meetingUrl, {
      status: meeting.status,
      startTime: meeting.startTime?.toISOString() ?? null,
      meetingUrl: meeting.meetingUrl,
      voiceRecordingId: meeting.voiceRecordingId,
      hasTranscript: Boolean(meeting.voiceRecording?.transcript)
    });

    const organizer = nodeId("member", meeting.organizerUserId);
    if (nodeMap.has(organizer)) {
      pushEdge(edges, seenEdges, organizer, nodeId("meeting", meeting.id), "organizes");
    }

    if (meeting.voiceRecordingId) {
      recordingToMeeting.set(meeting.voiceRecordingId, meeting.id);
    }
  }

  for (const unit of input.workUnits) {
    pushNode(nodeMap, "work_unit", unit.id, unit.title, {
      status: unit.status,
      audioRecordingId: unit.audioRecordingId,
      assigneeSpokenName: unit.assigneeSpokenName
    });

    const owner = nodeId("member", unit.userId);
    if (nodeMap.has(owner)) {
      pushEdge(edges, seenEdges, nodeId("work_unit", unit.id), owner, "owned_by");
    }

    if (unit.createdById) {
      const creator = nodeId("member", unit.createdById);
      if (nodeMap.has(creator)) {
        pushEdge(edges, seenEdges, nodeId("work_unit", unit.id), creator, "created_by");
      }
    }

    if (unit.projectId) {
      const projectNode = nodeId("project", unit.projectId);
      if (nodeMap.has(projectNode)) {
        pushEdge(edges, seenEdges, nodeId("work_unit", unit.id), projectNode, "belongs_to");
      }
    }

    if (unit.audioRecordingId) {
      const meetingId = recordingToMeeting.get(unit.audioRecordingId);
      if (meetingId) {
        pushEdge(
          edges,
          seenEdges,
          nodeId("work_unit", unit.id),
          nodeId("meeting", meetingId),
          "derived_from"
        );
      }
    }

    if (input.includeSteps) {
      for (const step of unit.steps) {
        pushNode(nodeMap, "work_step", step.id, step.description.slice(0, 120), {
          done: step.done,
          workUnitId: unit.id
        });
        pushEdge(
          edges,
          seenEdges,
          nodeId("work_unit", unit.id),
          nodeId("work_step", step.id),
          "belongs_to"
        );
        if (step.assigneeId) {
          const assignee = nodeId("member", step.assigneeId);
          if (nodeMap.has(assignee)) {
            pushEdge(
              edges,
              seenEdges,
              nodeId("work_step", step.id),
              assignee,
              "assigned_to"
            );
          }
        }
      }
    } else {
      for (const step of unit.steps) {
        if (!step.assigneeId) continue;
        const assignee = nodeId("member", step.assigneeId);
        if (!nodeMap.has(assignee)) continue;
        pushEdge(
          edges,
          seenEdges,
          nodeId("work_unit", unit.id),
          assignee,
          "assigned_to",
          { label: step.description.slice(0, 80) }
        );
      }
    }
  }

  // Co-attendance: people linked to same meeting via derived work
  const meetingMembers = new Map<string, Set<string>>();
  for (const unit of input.workUnits) {
    if (!unit.audioRecordingId) continue;
    const meetingId = recordingToMeeting.get(unit.audioRecordingId);
    if (!meetingId) continue;
    const set = meetingMembers.get(meetingId) ?? new Set<string>();
    set.add(unit.userId);
    if (unit.createdById) set.add(unit.createdById);
    for (const step of unit.steps) {
      if (step.assigneeId) set.add(step.assigneeId);
    }
    meetingMembers.set(meetingId, set);
  }

  for (const [meetingId, memberIds] of meetingMembers) {
    const ids = [...memberIds];
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = nodeId("member", ids[i]!);
        const b = nodeId("member", ids[j]!);
        if (!nodeMap.has(a) || !nodeMap.has(b)) continue;
        pushEdge(edges, seenEdges, a, b, "co_attended", {
          label: `shared meeting`,
          weight: 0.6
        });
        pushEdge(edges, seenEdges, a, nodeId("meeting", meetingId), "co_attended");
        pushEdge(edges, seenEdges, b, nodeId("meeting", meetingId), "co_attended");
      }
    }
  }

  for (const idea of input.ideas) {
    pushNode(nodeMap, "idea", idea.id, idea.title, {
      description: idea.description.slice(0, 200)
    });
    const author = nodeId("member", idea.authorId);
    if (nodeMap.has(author)) {
      pushEdge(edges, seenEdges, author, nodeId("idea", idea.id), "authored");
    }
  }

  for (const match of input.ideaMatches) {
    if (match.candidateIdeaId) {
      const source = nodeId("idea", match.ideaId);
      const target = nodeId("idea", match.candidateIdeaId);
      if (nodeMap.has(source) && nodeMap.has(target)) {
        pushEdge(edges, seenEdges, source, target, "similar_to", {
          weight: match.score
        });
      }
    }
    if (match.matchedUserId) {
      const ideaNode = nodeId("idea", match.ideaId);
      const userNode = nodeId("member", match.matchedUserId);
      if (nodeMap.has(ideaNode) && nodeMap.has(userNode)) {
        pushEdge(edges, seenEdges, ideaNode, userNode, "suggested_collaborator", {
          weight: match.score
        });
      }
    }
  }

  return {
    nodes: [...nodeMap.values()],
    edges
  };
}

export function applyNodeDegrees(nodes: BrainNode[], edges: BrainEdge[]): BrainNode[] {
  const degree = new Map<string, number>();
  for (const edge of edges) {
    degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1);
    degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);
  }

  return nodes.map((node) => ({
    ...node,
    val: 1 + (degree.get(node.id) ?? 0)
  }));
}
