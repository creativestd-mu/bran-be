type UserMini = { id: string; name: string; email: string };

export type TaggingMapping = {
  target: "work_unit_owner" | "step";
  workUnitId: string;
  stepId: string | null;
  sourceExcerpt: string | null;
  spokenName: string | null;
  assigneeId: string | null;
  assignee: UserMini | null;
};

type WorkUnitForTagging = {
  id: string;
  userId: string;
  assigneeSpokenName?: string | null;
  sourceExcerpt?: string | null;
  user?: UserMini | null;
  steps: Array<{
    id: string;
    assigneeId?: string | null;
    assigneeSpokenName?: string | null;
    sourceExcerpt?: string | null;
    assignee?: UserMini | null;
  }>;
};

export function buildTaggingMappings(workUnit: WorkUnitForTagging): TaggingMapping[] {
  const mappings: TaggingMapping[] = [];

  if (workUnit.assigneeSpokenName || workUnit.sourceExcerpt) {
    mappings.push({
      target: "work_unit_owner",
      workUnitId: workUnit.id,
      stepId: null,
      sourceExcerpt: workUnit.sourceExcerpt ?? null,
      spokenName: workUnit.assigneeSpokenName ?? null,
      assigneeId: workUnit.userId,
      assignee: workUnit.user ?? null
    });
  }

  for (const step of workUnit.steps) {
    if (!step.assigneeSpokenName && !step.sourceExcerpt && !step.assigneeId) {
      continue;
    }

    mappings.push({
      target: "step",
      workUnitId: workUnit.id,
      stepId: step.id,
      sourceExcerpt: step.sourceExcerpt ?? null,
      spokenName: step.assigneeSpokenName ?? null,
      assigneeId: step.assigneeId ?? null,
      assignee: step.assignee ?? null
    });
  }

  return mappings;
}

export function enrichWorkUnitWithTagging<
  T extends WorkUnitForTagging & {
    audioRecording?: { transcript: string | null } | null;
  }
>(unit: T, transcript?: string | null) {
  const resolvedTranscript = transcript ?? unit.audioRecording?.transcript ?? null;

  return {
    ...unit,
    transcript: resolvedTranscript,
    taggingMappings: buildTaggingMappings(unit)
  };
}
