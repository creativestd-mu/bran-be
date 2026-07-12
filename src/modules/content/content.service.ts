import { env } from "../../config/env";
import { HttpError } from "../../utils/httpError";
import {
  cancelReservationForResource,
  syncReservationForResource,
  syncReservationsForNode
} from "../inventory/inventory.reservations";
import { findUserByEmail } from "../users/users.repository";
import {
  notifyNextStepReady,
  notifyResourceRequested,
  notifyResourceReviewed,
  notifyShootBriefDispatched,
  notifyEditAssigned,
  notifyBuildAssigned
} from "../notifications/notifications.service";
import {
  ApprovalState,
  APPROVAL_STATES,
  APPROVE_PERMISSION,
  APPROVE_RENTAL_PERMISSION,
  CONTENT_STATUSES,
  CONTENT_TYPES,
  ContentStatus,
  ContentType,
  isLegalApprovalTransition,
  isLegalResourceApprovalTransition,
  NODE_KINDS,
  NODE_STATUSES,
  NodeKind,
  NodeStatus,
  RESOURCE_APPROVAL_STATES,
  RESOURCE_SOURCE_TYPES,
  ResourceApprovalState,
  ResourceSourceType,
  TEAM_ROLES,
  TeamRole
} from "./content.constants";
import {
  addNodeTeamMember,
  countPendingRentalResourcesForNode,
  createContent,
  createNode,
  createOutput,
  createResource,
  deleteContent,
  deleteNode,
  deleteOutput,
  deleteResource,
  demoteOtherApprovedOutputs,
  getContentById as repoGetContentById,
  getLatestApprovedOutputForNode,
  getMaxOrderIndexForContent,
  getMaxOutputVersion,
  getNodeById,
  getNodeByContentAndOrder,
  getNodeTeamMemberById,
  getOutputById,
  getProjectForContentLink,
  getResourceById,
  getTeamForContentLink,
  getVerticalOwnerForContent,
  listContents as repoListContents,
  removeNodeTeamMember,
  updateContent,
  updateNode,
  updateOutput,
  updateResource,
  userHasPermission
} from "./content.repository";

type Actor = { userId: string; roleId: string };

function parseOptionalDate(value?: string | null): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new HttpError(400, `Invalid date: ${value}`);
  }
  return date;
}

function assertEnum<T extends readonly string[]>(
  values: T,
  value: string,
  label: string
): asserts value is T[number] {
  if (!values.includes(value as T[number])) {
    throw new HttpError(400, `Invalid ${label}: ${value}. Allowed: ${values.join(", ")}`);
  }
}

function assertOptionalEnum<T extends readonly string[]>(
  values: T,
  value: string | undefined,
  label: string
) {
  if (value === undefined) return;
  assertEnum(values, value, label);
}

async function loadNodeOrThrow(nodeId: string) {
  const node = await getNodeById(nodeId);
  if (!node) throw new HttpError(404, "Content node not found");
  return node;
}

async function loadContentOrThrow(contentId: string) {
  const content = await repoGetContentById(contentId);
  if (!content) throw new HttpError(404, "Content not found");
  return content;
}

function assertContentCreator(content: { createdById: string | null }, actor: Actor) {
  if (!content.createdById || content.createdById !== actor.userId) {
    throw new HttpError(403, "Only the content creator may dispatch ops assignments");
  }
}

async function loadShootNodeContext(nodeId: string, actor: Actor) {
  const node = await loadNodeOrThrow(nodeId);
  if (node.kind !== "SHOOT") {
    throw new HttpError(400, "Ops dispatch is only available on SHOOT nodes");
  }
  const content = await loadContentOrThrow(node.contentId);
  assertContentCreator(content, actor);
  return { node, content };
}

function formatShootBriefNotes(input: {
  location: string;
  scriptLink?: string | null;
  scenes?: string | null;
  notes?: string | null;
}): string {
  const lines: string[] = [`Location: ${input.location}`];
  if (input.scriptLink) lines.push(`Script: ${input.scriptLink}`);
  if (input.scenes) lines.push(`Scenes: ${input.scenes}`);
  if (input.notes) lines.push(`Notes: ${input.notes}`);
  return lines.join("\n");
}

function formatEditAssignNotes(input: {
  footage?: string | null;
  notes?: string | null;
}): string {
  const lines: string[] = [];
  if (input.footage) lines.push(`Footage: ${input.footage}`);
  if (input.notes) lines.push(`Notes: ${input.notes}`);
  return lines.join("\n");
}

function formatBuildAssignNotes(input: {
  projectName: string;
  phase?: string | null;
  materials?: string | null;
  files?: string | null;
  notes?: string | null;
}): string {
  const lines: string[] = [`Project: ${input.projectName}`];
  if (input.phase) lines.push(`Phase: ${input.phase}`);
  if (input.materials) lines.push(`Materials: ${input.materials}`);
  if (input.files) lines.push(`Files: ${input.files}`);
  if (input.notes) lines.push(`Notes: ${input.notes}`);
  return lines.join("\n");
}

async function loadOutputOrThrow(outputId: string) {
  const output = await getOutputById(outputId);
  if (!output) throw new HttpError(404, "Output not found");
  return output;
}

function attachComputedInputs(content: Awaited<ReturnType<typeof repoGetContentById>>) {
  if (!content) return content;

  // Sort once for predictable predecessor lookup.
  const nodesByOrder = [...content.nodes].sort((a, b) => a.orderIndex - b.orderIndex);
  const decoratedNodes = nodesByOrder.map((node, idx) => {
    if (idx === 0) {
      return { ...node, input: null };
    }
    const prev = nodesByOrder[idx - 1];
    const approved = prev.outputs
      .filter((o) => o.approvalState === "APPROVED")
      .sort((a, b) => {
        if (b.version !== a.version) return b.version - a.version;
        const ar = a.reviewedAt?.getTime() ?? 0;
        const br = b.reviewedAt?.getTime() ?? 0;
        return br - ar;
      })[0];

    return {
      ...node,
      input: approved
        ? {
            fromNodeId: prev.id,
            fromNodeKind: prev.kind,
            fromNodeName: prev.name,
            output: approved
          }
        : null
    };
  });

  return { ...content, nodes: decoratedNodes };
}

// ── Content ───────────────────────────────────────────────

/**
 * Resolve and validate the (team, project) pair a Content row should link
 * to. Both must exist and share the same vertical so the downstream
 * "vertical head approves rentals" flow has an unambiguous owner.
 */
async function assertTeamProjectPair(teamId: string, projectId: string) {
  const [team, project] = await Promise.all([
    getTeamForContentLink(teamId),
    getProjectForContentLink(projectId)
  ]);
  if (!team) throw new HttpError(404, "Team not found");
  if (!project) throw new HttpError(404, "Project not found");
  if (team.isActive === false) {
    throw new HttpError(400, "Team is not active");
  }
  if (team.verticalId !== project.verticalId) {
    throw new HttpError(
      400,
      "Team and Project must belong to the same vertical"
    );
  }
  return { team, project };
}

export async function createContentService(input: {
  title: string;
  description?: string;
  type: string;
  status?: string;
  teamId: string;
  projectId: string;
  createdById?: string;
}) {
  assertEnum(CONTENT_TYPES, input.type, "content type");
  assertOptionalEnum(CONTENT_STATUSES, input.status, "content status");
  await assertTeamProjectPair(input.teamId, input.projectId);

  const created = await createContent({
    title: input.title,
    description: input.description,
    type: input.type as ContentType,
    status: (input.status as ContentStatus | undefined) ?? "DRAFT",
    teamId: input.teamId,
    projectId: input.projectId,
    createdById: input.createdById
  });
  return attachComputedInputs(created);
}

export async function listContentsService(filters: {
  type?: string;
  status?: string;
  createdById?: string;
  teamId?: string;
  projectId?: string;
  verticalId?: string;
}) {
  if (filters.type) assertEnum(CONTENT_TYPES, filters.type, "content type");
  if (filters.status) assertEnum(CONTENT_STATUSES, filters.status, "content status");
  const list = await repoListContents(filters);
  return list.map((c) => attachComputedInputs(c));
}

export async function getContentService(id: string) {
  const content = await loadContentOrThrow(id);
  return attachComputedInputs(content);
}

export async function updateContentService(
  id: string,
  input: {
    title?: string;
    description?: string | null;
    type?: string;
    status?: string;
    teamId?: string;
    projectId?: string;
  }
) {
  const existing = await loadContentOrThrow(id);
  if (input.type) assertEnum(CONTENT_TYPES, input.type, "content type");
  if (input.status) assertEnum(CONTENT_STATUSES, input.status, "content status");

  // If either link is being changed we must re-validate the pair as a whole
  // so the new (team, project) still share a vertical.
  if (input.teamId !== undefined || input.projectId !== undefined) {
    const nextTeamId = input.teamId ?? existing.teamId;
    const nextProjectId = input.projectId ?? existing.projectId;
    await assertTeamProjectPair(nextTeamId, nextProjectId);
  }

  const updated = await updateContent(id, {
    title: input.title,
    description: input.description,
    type: input.type as ContentType | undefined,
    status: input.status as ContentStatus | undefined,
    teamId: input.teamId,
    projectId: input.projectId
  });
  return attachComputedInputs(updated);
}

export async function deleteContentService(id: string) {
  await loadContentOrThrow(id);
  return deleteContent(id);
}

// ── Nodes ─────────────────────────────────────────────────

export async function createNodeService(input: {
  contentId: string;
  kind: string;
  name: string;
  orderIndex?: number;
  notes?: string;
  startsAt?: string;
  dueDate?: string;
}) {
  await loadContentOrThrow(input.contentId);
  assertEnum(NODE_KINDS, input.kind, "node kind");

  let orderIndex = input.orderIndex;
  if (orderIndex === undefined) {
    const max = await getMaxOrderIndexForContent(input.contentId);
    orderIndex = max === null ? 0 : max + 1;
  } else if (orderIndex < 0) {
    throw new HttpError(400, "orderIndex must be >= 0");
  } else {
    const existing = await getNodeByContentAndOrder(input.contentId, orderIndex);
    if (existing) {
      throw new HttpError(409, `A node with orderIndex ${orderIndex} already exists`);
    }
  }

  return createNode({
    contentId: input.contentId,
    kind: input.kind as NodeKind,
    name: input.name,
    orderIndex,
    notes: input.notes,
    startsAt: parseOptionalDate(input.startsAt) ?? undefined,
    dueDate: parseOptionalDate(input.dueDate) ?? undefined
  });
}

export async function updateNodeService(
  nodeId: string,
  input: {
    kind?: string;
    name?: string;
    orderIndex?: number;
    notes?: string | null;
    startsAt?: string | null;
    dueDate?: string | null;
  }
) {
  const node = await loadNodeOrThrow(nodeId);

  if (input.kind) assertEnum(NODE_KINDS, input.kind, "node kind");

  if (input.orderIndex !== undefined && input.orderIndex !== node.orderIndex) {
    if (input.orderIndex < 0) throw new HttpError(400, "orderIndex must be >= 0");
    const clash = await getNodeByContentAndOrder(node.contentId, input.orderIndex);
    if (clash && clash.id !== nodeId) {
      throw new HttpError(409, `A node with orderIndex ${input.orderIndex} already exists`);
    }
  }

  return updateNode(nodeId, {
    kind: input.kind as NodeKind | undefined,
    name: input.name,
    orderIndex: input.orderIndex,
    notes: input.notes,
    startsAt: parseOptionalDate(input.startsAt),
    dueDate: parseOptionalDate(input.dueDate)
  }).then(async (updated) => {
    await syncReservationsForNode(nodeId);
    return updated;
  });
}

/**
 * Strict sequencing rules:
 *  - To leave PENDING (start work) the predecessor (if any) must have an APPROVED output.
 *  - To enter COMPLETED this node must have an APPROVED output.
 */
export async function updateNodeStatusService(nodeId: string, status: string) {
  assertEnum(NODE_STATUSES, status, "node status");
  const node = await loadNodeOrThrow(nodeId);
  const next = status as NodeStatus;

  if (node.status === "PENDING" && next !== "PENDING") {
    if (node.orderIndex > 0) {
      const predecessor = await getNodeByContentAndOrder(node.contentId, node.orderIndex - 1);
      if (predecessor) {
        const approved = await getLatestApprovedOutputForNode(predecessor.id);
        if (!approved) {
          throw new HttpError(
            409,
            "Cannot start this node: predecessor has no APPROVED output yet"
          );
        }
      }
    }
  }

  if (next === "COMPLETED") {
    const approved = await getLatestApprovedOutputForNode(nodeId);
    if (!approved) {
      throw new HttpError(409, "Cannot complete this node: no APPROVED output exists");
    }
    // RENTAL resources gate completion: every rental request on this node
    // must be APPROVED by the vertical head before work can be marked done.
    const pendingRentals = await countPendingRentalResourcesForNode(nodeId);
    if (pendingRentals > 0) {
      throw new HttpError(
        409,
        `Cannot complete this node: ${pendingRentals} rental resource(s) still awaiting approval`
      );
    }
  }

  let completedAt: Date | null | undefined;
  if (next === "COMPLETED") {
    completedAt = new Date();
  } else if (node.completedAt) {
    // If moving away from COMPLETED, clear the timestamp.
    completedAt = null;
  }

  const updated = await updateNode(nodeId, {
    status: next,
    completedAt
  });

  // Fire-and-forget: notify the next step's assignees (and the content owner)
  // exactly once when this node transitions into COMPLETED. Failures are
  // intentionally swallowed so a flaky email transport never blocks the
  // status change itself.
  if (node.status !== "COMPLETED" && next === "COMPLETED") {
    void notifyNextStepAssignees(nodeId).catch((error) => {
      console.error(`[notifications] fan-out failed for node ${nodeId}:`, error);
    });
  }

  return updated;
}

/**
 * Resolve the next node, the just-approved output, and the recipient set
 * (next-node assignees + content owner), then dispatch notifications.
 *
 * Silently no-ops when there is no next node or no APPROVED output yet.
 */
async function notifyNextStepAssignees(completedNodeId: string): Promise<void> {
  const completedNode = await getNodeById(completedNodeId);
  if (!completedNode) return;

  const nextNode = await getNodeByContentAndOrder(
    completedNode.contentId,
    completedNode.orderIndex + 1
  );
  if (!nextNode) return;

  const approvedOutput = await getLatestApprovedOutputForNode(completedNode.id);
  if (!approvedOutput) return;

  const content = await repoGetContentById(completedNode.contentId);
  if (!content) return;

  const recipientUserIds = new Set<string>();
  for (const member of nextNode.team) {
    recipientUserIds.add(member.userId);
  }
  if (content.createdById) {
    recipientUserIds.add(content.createdById);
  }
  if (recipientUserIds.size === 0) return;

  await notifyNextStepReady({
    content: {
      id: content.id,
      title: content.title,
      ownerId: content.createdById
    },
    fromNode: {
      id: completedNode.id,
      name: completedNode.name,
      kind: completedNode.kind,
      orderIndex: completedNode.orderIndex
    },
    toNode: {
      id: nextNode.id,
      name: nextNode.name,
      kind: nextNode.kind,
      orderIndex: nextNode.orderIndex
    },
    approvedOutput: {
      id: approvedOutput.id,
      label: approvedOutput.label,
      url: approvedOutput.url,
      notes: approvedOutput.notes,
      version: approvedOutput.version,
      reviewedAt: approvedOutput.reviewedAt,
      approvalState: approvedOutput.approvalState,
      reviewedBy: approvedOutput.reviewedBy
        ? {
            id: approvedOutput.reviewedBy.id,
            name: approvedOutput.reviewedBy.name,
            email: approvedOutput.reviewedBy.email
          }
        : null,
      submittedBy: approvedOutput.submittedBy
        ? {
            id: approvedOutput.submittedBy.id,
            name: approvedOutput.submittedBy.name,
            email: approvedOutput.submittedBy.email
          }
        : null
    },
    recipientUserIds: Array.from(recipientUserIds)
  });
}

export async function deleteNodeService(nodeId: string) {
  await loadNodeOrThrow(nodeId);
  return deleteNode(nodeId);
}

// ── Team ──────────────────────────────────────────────────

export async function addNodeTeamMemberService(input: {
  nodeId: string;
  userId: string;
  role: string;
}) {
  await loadNodeOrThrow(input.nodeId);
  assertEnum(TEAM_ROLES, input.role, "team role");
  return addNodeTeamMember({
    nodeId: input.nodeId,
    userId: input.userId,
    role: input.role as TeamRole
  });
}

export async function removeNodeTeamMemberService(teamMemberId: string) {
  const member = await getNodeTeamMemberById(teamMemberId);
  if (!member) throw new HttpError(404, "Team member not found");
  return removeNodeTeamMember(teamMemberId);
}

// ── Outputs ───────────────────────────────────────────────

export async function createOutputService(input: {
  nodeId: string;
  label: string;
  url: string;
  notes?: string;
  submittedByUserId?: string;
}) {
  await loadNodeOrThrow(input.nodeId);
  const maxVersion = await getMaxOutputVersion(input.nodeId);
  const version = maxVersion === null ? 1 : maxVersion + 1;
  return createOutput({
    nodeId: input.nodeId,
    label: input.label,
    url: input.url,
    notes: input.notes,
    version,
    submittedByUserId: input.submittedByUserId
  });
}

export async function updateOutputService(
  outputId: string,
  input: { label?: string; url?: string; notes?: string | null }
) {
  await loadOutputOrThrow(outputId);
  return updateOutput(outputId, {
    label: input.label,
    url: input.url,
    notes: input.notes
  });
}

export async function deleteOutputService(outputId: string) {
  await loadOutputOrThrow(outputId);
  return deleteOutput(outputId);
}

/**
 * Approve / reject / move an output through its review lifecycle.
 *
 * Authorization: the caller must be the Content owner OR hold the
 * `approve_resources` permission on their role.
 *
 * On a transition to APPROVED any other APPROVED outputs on the same
 * node are demoted back to IN_REVIEW (single-approved invariant).
 */
export async function reviewOutputService(
  outputId: string,
  input: { approvalState: string; reviewNote?: string | null },
  actor: Actor
) {
  assertEnum(APPROVAL_STATES, input.approvalState, "approval state");
  const next = input.approvalState as ApprovalState;

  const output = await loadOutputOrThrow(outputId);
  const node = await loadNodeOrThrow(output.nodeId);
  const content = await loadContentOrThrow(node.contentId);

  const isOwner = !!content.createdById && content.createdById === actor.userId;
  let allowed = isOwner;
  if (!allowed) {
    allowed = await userHasPermission(actor.roleId, APPROVE_PERMISSION);
  }
  if (!allowed) {
    throw new HttpError(
      403,
      "Only the content owner or a user with approve_resources may review outputs"
    );
  }

  const current = output.approvalState as ApprovalState;
  if (!isLegalApprovalTransition(current, next)) {
    throw new HttpError(400, `Illegal transition: ${current} -> ${next}`);
  }

  const updated = await updateOutput(outputId, {
    approvalState: next,
    reviewNote: input.reviewNote ?? null,
    reviewedByUserId: actor.userId,
    reviewedAt: new Date()
  });

  if (next === "APPROVED") {
    await demoteOtherApprovedOutputs(output.nodeId, outputId);
  }

  return updated;
}

// ── Resources ─────────────────────────────────────────────

/**
 * Cost / currency are only meaningful for RENTAL resources.
 *  - RENTAL  -> `cost` is required (>= 0). `currency` defaults to "INR".
 *  - IN_HOUSE -> `cost` and `currency` are forced to null regardless of input.
 */
function normaliseResourceCostFields(
  sourceType: ResourceSourceType,
  cost: number | string | null | undefined,
  currency: string | null | undefined
): { cost: number | string | null; currency: string | null } {
  if (sourceType === "IN_HOUSE") {
    return { cost: null, currency: null };
  }
  if (cost === undefined || cost === null || cost === "") {
    throw new HttpError(400, "cost is required when sourceType is RENTAL");
  }
  const numeric = typeof cost === "string" ? Number(cost) : cost;
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new HttpError(400, "cost must be a non-negative number");
  }
  return { cost, currency: currency && currency.length > 0 ? currency : "INR" };
}

export async function createResourceService(input: {
  nodeId: string;
  name: string;
  sourceType?: string;
  inventoryItemId?: string;
  cost?: number | string | null;
  quantity?: number;
  currency?: string | null;
  notes?: string;
  requestedByUserId?: string;
}) {
  const node = await loadNodeOrThrow(input.nodeId);
  const sourceType = (input.sourceType ?? "IN_HOUSE") as ResourceSourceType;
  assertEnum(RESOURCE_SOURCE_TYPES, sourceType, "resource sourceType");

  const { cost, currency } = normaliseResourceCostFields(sourceType, input.cost, input.currency);

  // IN_HOUSE resources don't need approval; mark them APPROVED at creation
  // so the node-completion gate is a no-op for them.
  const approvalState: ResourceApprovalState = sourceType === "RENTAL" ? "PENDING" : "APPROVED";

  const created = await createResource({
    nodeId: input.nodeId,
    name: input.name,
    sourceType,
    inventoryItemId: input.inventoryItemId ?? null,
    cost,
    quantity: input.quantity,
    currency,
    notes: input.notes,
    approvalState,
    requestedByUserId: input.requestedByUserId ?? null
  });

  if (input.inventoryItemId) {
    await syncReservationForResource({
      resourceId: created.id,
      node,
      inventoryItemId: input.inventoryItemId,
      createdById: input.requestedByUserId
    });
  }

  // Fire-and-forget: notify the vertical head only for RENTAL requests.
  // Failures are intentionally swallowed so a flaky email transport never
  // blocks resource creation itself.
  if (sourceType === "RENTAL") {
    void fanOutRentalResourceRequested(created.id);
  }

  return created;
}

/**
 * Resolve recipients (vertical head of the content's project + the global
 * admin user) and dispatch a "resource requested" notification. Safe to
 * invoke from any code path that produces a PENDING rental request:
 * idempotent per (recipient, resource) via the dedupe key inside
 * notifyResourceRequested.
 */
async function notifyRentalResourceRequested(resourceId: string): Promise<void> {
  const resource = await getResourceById(resourceId);
  if (!resource || resource.sourceType !== "RENTAL") return;

  const node = await getNodeById(resource.nodeId);
  if (!node) return;

  const enriched = await getVerticalOwnerForContent(node.contentId);
  if (!enriched) return;

  const verticalOwner = enriched.project?.vertical?.owner ?? null;

  const recipientUserIds = new Set<string>();
  if (verticalOwner && verticalOwner.isActive !== false) {
    recipientUserIds.add(verticalOwner.id);
  }

  // Always cc the configured admin user so rental requests are visible
  // to ops even when a vertical has no head assigned yet.
  const adminEmail = env.notificationsAdminEmail;
  if (adminEmail) {
    const admin = await findUserByEmail(adminEmail);
    if (admin && admin.isActive !== false) {
      recipientUserIds.add(admin.id);
    }
  }

  if (recipientUserIds.size === 0) return;

  await notifyResourceRequested({
    content: {
      id: enriched.id,
      title: enriched.title,
      ownerId: null,
      verticalName: enriched.project?.vertical?.name ?? null
    },
    node: {
      id: node.id,
      name: node.name,
      kind: node.kind,
      orderIndex: node.orderIndex
    },
    resource: {
      id: resource.id,
      name: resource.name,
      sourceType: resource.sourceType,
      cost: resource.cost === null ? null : resource.cost.toString(),
      currency: resource.currency,
      quantity: resource.quantity,
      notes: resource.notes
    },
    requestedBy: resource.requestedBy
      ? {
          id: resource.requestedBy.id,
          name: resource.requestedBy.name,
          email: resource.requestedBy.email
        }
      : null,
    recipientUserIds: Array.from(recipientUserIds)
  });
}

/**
 * Fire-and-forget wrapper used from request-producing code paths so a
 * flaky email transport or missing recipient never blocks the underlying
 * write.
 */
function fanOutRentalResourceRequested(resourceId: string): Promise<void> {
  return notifyRentalResourceRequested(resourceId).catch((error) => {
    console.error(
      `[notifications] rental request fan-out failed for resource ${resourceId}:`,
      error
    );
  });
}

export async function updateResourceService(
  resourceId: string,
  input: {
    name?: string;
    sourceType?: string;
    inventoryItemId?: string | null;
    cost?: number | string | null;
    quantity?: number;
    currency?: string | null;
    notes?: string | null;
  }
) {
  const resource = await getResourceById(resourceId);
  if (!resource) throw new HttpError(404, "Resource not found");

  const node = await loadNodeOrThrow(resource.nodeId);

  const nextSourceType = (input.sourceType ?? resource.sourceType) as ResourceSourceType;
  if (input.sourceType) {
    assertEnum(RESOURCE_SOURCE_TYPES, input.sourceType, "resource sourceType");
  }

  // Only renormalise cost/currency if the caller is changing sourceType, cost,
  // or currency. Otherwise leave the existing values untouched.
  const touchingCostFields =
    input.sourceType !== undefined ||
    input.cost !== undefined ||
    input.currency !== undefined;

  let normalisedCost: number | string | null | undefined;
  let normalisedCurrency: string | null | undefined;
  if (touchingCostFields) {
    const nextCost =
      input.cost !== undefined
        ? input.cost
        : resource.cost === null
          ? null
          : resource.cost.toString();
    const nextCurrency = input.currency !== undefined ? input.currency : resource.currency;
    const result = normaliseResourceCostFields(nextSourceType, nextCost, nextCurrency);
    normalisedCost = result.cost;
    normalisedCurrency = result.currency;
  }

  // Flipping sourceType resets the approval workflow:
  //   IN_HOUSE -> RENTAL : revert to PENDING (vertical head must re-approve)
  //   RENTAL  -> IN_HOUSE: implicit APPROVED (no review needed)
  let nextApprovalState: ResourceApprovalState | undefined;
  let resetReviewFields = false;
  if (input.sourceType && input.sourceType !== resource.sourceType) {
    nextApprovalState = nextSourceType === "RENTAL" ? "PENDING" : "APPROVED";
    resetReviewFields = true;
  }

  const updated = await updateResource(resourceId, {
    name: input.name,
    sourceType: input.sourceType ? nextSourceType : undefined,
    inventoryItemId: input.inventoryItemId,
    cost: normalisedCost,
    quantity: input.quantity,
    currency: normalisedCurrency,
    notes: input.notes,
    approvalState: nextApprovalState,
    reviewNote: resetReviewFields ? null : undefined,
    reviewedByUserId: resetReviewFields ? null : undefined,
    reviewedAt: resetReviewFields ? null : undefined
  });

  if (input.inventoryItemId !== undefined) {
    await syncReservationForResource({
      resourceId: updated.id,
      node,
      inventoryItemId: input.inventoryItemId
    });
  }

  // An IN_HOUSE → RENTAL flip produces a fresh rental request that needs
  // the same fan-out as creation. We trigger on the resulting state, not
  // on the input shape, so future paths that land a row in RENTAL+PENDING
  // get notified for free.
  if (updated.sourceType === "RENTAL" && updated.approvalState === "PENDING") {
    void fanOutRentalResourceRequested(updated.id);
  }

  return updated;
}

export async function deleteResourceService(resourceId: string) {
  const resource = await getResourceById(resourceId);
  if (!resource) throw new HttpError(404, "Resource not found");
  await cancelReservationForResource(resourceId);
  return deleteResource(resourceId);
}

/**
 * Approve / reject a RENTAL resource. Authorization:
 *   - the vertical owner ("head of Fiction" / "head of Non Fiction"); OR
 *   - any user holding the `approve_rental_resources` permission.
 *
 * IN_HOUSE resources do not go through review and are rejected here so
 * callers don't accidentally toggle their state.
 */
export async function reviewResourceService(
  resourceId: string,
  input: { approvalState: string; reviewNote?: string | null },
  actor: Actor
) {
  assertEnum(RESOURCE_APPROVAL_STATES, input.approvalState, "resource approval state");
  const next = input.approvalState as ResourceApprovalState;

  const resource = await getResourceById(resourceId);
  if (!resource) throw new HttpError(404, "Resource not found");
  if (resource.sourceType !== "RENTAL") {
    throw new HttpError(400, "Only RENTAL resources require approval");
  }

  const node = await loadNodeOrThrow(resource.nodeId);
  const content = await loadContentOrThrow(node.contentId);

  // Resolve the vertical head for this content; either they or someone with
  // the dedicated permission is allowed to act on the request.
  const enriched = await getVerticalOwnerForContent(content.id);
  const verticalOwnerId = enriched?.project?.vertical?.ownerUserId ?? null;
  const verticalName = enriched?.project?.vertical?.name ?? null;

  const isVerticalOwner = !!verticalOwnerId && verticalOwnerId === actor.userId;
  let allowed = isVerticalOwner;
  if (!allowed) {
    allowed = await userHasPermission(actor.roleId, APPROVE_RENTAL_PERMISSION);
  }
  if (!allowed) {
    throw new HttpError(
      403,
      `Only the vertical head${
        verticalName ? ` (${verticalName})` : ""
      } or a user with approve_rental_resources may review rental resources`
    );
  }

  // Prevent the requester from approving or rejecting their own request.
  if (resource.requestedByUserId && resource.requestedByUserId === actor.userId) {
    throw new HttpError(403, "You cannot approve or reject your own resource request");
  }

  const current = resource.approvalState as ResourceApprovalState;
  if (!isLegalResourceApprovalTransition(current, next)) {
    throw new HttpError(400, `Illegal transition: ${current} -> ${next}`);
  }

  const updated = await updateResource(resourceId, {
    approvalState: next,
    reviewNote: input.reviewNote ?? null,
    reviewedByUserId: actor.userId,
    reviewedAt: new Date()
  });

  // Best-effort notify the requester (and content owner) of the decision.
  if (resource.requestedByUserId || content.createdById) {
    void notifyRentalResourceReviewed(content.id, resourceId).catch((error) => {
      console.error(
        `[notifications] resource-reviewed fan-out failed for ${resourceId}:`,
        error
      );
    });
  }

  return updated;
}

async function notifyRentalResourceReviewed(
  contentId: string,
  resourceId: string
): Promise<void> {
  const resource = await getResourceById(resourceId);
  if (!resource) return;

  const node = await getNodeById(resource.nodeId);
  if (!node) return;

  const content = await repoGetContentById(contentId);
  if (!content) return;

  const recipients = new Set<string>();
  if (resource.requestedByUserId) recipients.add(resource.requestedByUserId);
  if (content.createdById) recipients.add(content.createdById);
  if (recipients.size === 0) return;

  await notifyResourceReviewed({
    content: {
      id: content.id,
      title: content.title,
      ownerId: content.createdById ?? null
    },
    node: {
      id: node.id,
      name: node.name,
      kind: node.kind,
      orderIndex: node.orderIndex
    },
    resource: {
      id: resource.id,
      name: resource.name,
      sourceType: resource.sourceType,
      cost: resource.cost === null ? null : resource.cost.toString(),
      currency: resource.currency,
      quantity: resource.quantity,
      notes: resource.notes,
      approvalState: resource.approvalState,
      reviewNote: resource.reviewNote
    },
    reviewedBy: resource.reviewedBy
      ? {
          id: resource.reviewedBy.id,
          name: resource.reviewedBy.name,
          email: resource.reviewedBy.email
        }
      : null,
    recipientUserIds: Array.from(recipients)
  });
}

// ── Ops hub (shoot brief / edit / build) ──────────────────

export async function dispatchShootBriefService(
  nodeId: string,
  input: {
    location: string;
    callTime: string;
    wrapTime?: string | null;
    people: string[];
    equipment?: string[];
    scriptLink?: string | null;
    scenes?: string | null;
    notes?: string | null;
  },
  actor: Actor
) {
  const { node, content } = await loadShootNodeContext(nodeId, actor);

  const startsAt = parseOptionalDate(input.callTime);
  if (!startsAt) {
    throw new HttpError(400, "callTime is required");
  }
  const wrapTime =
    input.wrapTime !== undefined ? parseOptionalDate(input.wrapTime) : undefined;

  await updateNode(nodeId, {
    startsAt,
    dueDate: wrapTime,
    notes: formatShootBriefNotes(input)
  });
  await syncReservationsForNode(nodeId);

  const existingTeamUserIds = new Set(node.team.map((member) => member.userId));
  for (const userId of input.people) {
    if (!existingTeamUserIds.has(userId)) {
      await addNodeTeamMember({ nodeId, userId, role: "CREW" });
    }
  }

  const existingResourceNames = new Set(
    node.resources.map((resource) => resource.name.toLowerCase())
  );
  for (const name of input.equipment ?? []) {
    if (existingResourceNames.has(name.toLowerCase())) continue;
    await createResource({
      nodeId,
      name,
      sourceType: "IN_HOUSE",
      approvalState: "APPROVED",
      requestedByUserId: actor.userId
    });
    existingResourceNames.add(name.toLowerCase());
  }

  void notifyShootBriefDispatched({
    contentId: content.id,
    contentTitle: content.title,
    nodeId,
    location: input.location,
    callTime: startsAt,
    wrapTime: wrapTime ?? null,
    scriptLink: input.scriptLink ?? null,
    scenes: input.scenes ?? null,
    notes: input.notes ?? null,
    equipment: input.equipment ?? [],
    recipientUserIds: input.people
  }).catch((error) => {
    console.error(`[notifications] shoot-brief fan-out failed for node ${nodeId}:`, error);
  });

  const refreshed = await getNodeById(nodeId);
  if (!refreshed) throw new HttpError(404, "Content node not found");
  return refreshed;
}

export async function dispatchEditAssignService(
  shootNodeId: string,
  input: {
    editorUserId: string;
    deadline: string;
    footage?: string | null;
    notes?: string | null;
  },
  actor: Actor
) {
  const { content } = await loadShootNodeContext(shootNodeId, actor);
  const fullContent = await repoGetContentById(content.id);
  const editingNode = fullContent?.nodes.find((node) => node.kind === "EDITING");
  if (!editingNode) {
    throw new HttpError(400, "No EDITING node exists on this content");
  }

  const deadline = parseOptionalDate(input.deadline);
  if (!deadline) {
    throw new HttpError(400, "deadline is required");
  }

  await updateNode(editingNode.id, {
    dueDate: deadline,
    notes: formatEditAssignNotes(input)
  });

  await addNodeTeamMember({
    nodeId: editingNode.id,
    userId: input.editorUserId,
    role: "EDITOR"
  });

  void notifyEditAssigned({
    contentId: content.id,
    contentTitle: content.title,
    nodeId: editingNode.id,
    editorUserId: input.editorUserId,
    deadline,
    footage: input.footage ?? null,
    notes: input.notes ?? null
  }).catch((error) => {
    console.error(
      `[notifications] edit-assign fan-out failed for node ${editingNode.id}:`,
      error
    );
  });

  const refreshed = await getNodeById(editingNode.id);
  if (!refreshed) throw new HttpError(404, "Content node not found");
  return refreshed;
}

export async function dispatchBuildAssignService(
  shootNodeId: string,
  input: {
    projectName: string;
    builderUserIds: string[];
    deadline: string;
    phase?: string | null;
    materials?: string | null;
    files?: string | null;
    notes?: string | null;
  },
  actor: Actor
) {
  const { content } = await loadShootNodeContext(shootNodeId, actor);
  const fullContent = await repoGetContentById(content.id);
  let buildNode = fullContent?.nodes.find((node) => node.kind === "BUILD");

  const deadline = parseOptionalDate(input.deadline);
  if (!deadline) {
    throw new HttpError(400, "deadline is required");
  }

  const notes = formatBuildAssignNotes(input);

  if (!buildNode) {
    const maxOrder = await getMaxOrderIndexForContent(content.id);
    buildNode = await createNode({
      contentId: content.id,
      kind: "BUILD",
      name: "Build",
      orderIndex: maxOrder === null ? 0 : maxOrder + 1,
      notes,
      dueDate: deadline
    });
  } else {
    await updateNode(buildNode.id, { dueDate: deadline, notes });
  }

  const buildNodeId = buildNode.id;
  const refreshed = await getNodeById(buildNodeId);
  const existingTeamUserIds = new Set(
    (refreshed?.team ?? buildNode.team).map((member) => member.userId)
  );
  for (const userId of input.builderUserIds) {
    if (!existingTeamUserIds.has(userId)) {
      await addNodeTeamMember({ nodeId: buildNodeId, userId, role: "CREW" });
    }
  }

  void notifyBuildAssigned({
    contentId: content.id,
    contentTitle: content.title,
    nodeId: buildNodeId,
    projectName: input.projectName,
    phase: input.phase ?? null,
    deadline,
    materials: input.materials ?? null,
    files: input.files ?? null,
    notes: input.notes ?? null,
    recipientUserIds: input.builderUserIds
  }).catch((error) => {
    console.error(`[notifications] build-assign fan-out failed for node ${buildNodeId}:`, error);
  });

  const result = await getNodeById(buildNodeId);
  if (!result) throw new HttpError(404, "Content node not found");
  return result;
}
