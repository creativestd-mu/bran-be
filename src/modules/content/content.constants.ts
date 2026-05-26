export const CONTENT_TYPES = ["PRODUCTION", "COVERAGE"] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

export const CONTENT_STATUSES = ["DRAFT", "IN_PROGRESS", "COMPLETED", "ARCHIVED"] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export const NODE_KINDS = [
  "SCRIPTING",
  "SHOOT",
  "EDITING",
  "BRIEF",
  "PUBLISHING",
  "OTHER"
] as const;
export type NodeKind = (typeof NODE_KINDS)[number];

export const NODE_STATUSES = ["PENDING", "IN_PROGRESS", "BLOCKED", "COMPLETED"] as const;
export type NodeStatus = (typeof NODE_STATUSES)[number];

export const TEAM_ROLES = [
  "SCRIPTER",
  "DIRECTOR",
  "DOP",
  "AD",
  "EDITOR",
  "ACTOR",
  "CREW",
  "OTHER"
] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

export const APPROVAL_STATES = [
  "PENDING",
  "IN_REVIEW",
  "CHANGES_REQUESTED",
  "APPROVED",
  "REJECTED"
] as const;
export type ApprovalState = (typeof APPROVAL_STATES)[number];

// Legal transitions for the output approval lifecycle.
// Anything not listed for a given source state is rejected by the service.
export const APPROVAL_TRANSITIONS: Record<ApprovalState, ApprovalState[]> = {
  PENDING: ["IN_REVIEW", "APPROVED", "REJECTED"],
  IN_REVIEW: ["CHANGES_REQUESTED", "APPROVED", "REJECTED"],
  CHANGES_REQUESTED: ["IN_REVIEW", "APPROVED", "REJECTED"],
  APPROVED: ["REJECTED", "IN_REVIEW"],
  REJECTED: ["IN_REVIEW"]
};

export function isLegalApprovalTransition(from: ApprovalState, to: ApprovalState): boolean {
  if (from === to) return false;
  return APPROVAL_TRANSITIONS[from]?.includes(to) ?? false;
}

export const RESOURCE_SOURCE_TYPES = ["IN_HOUSE", "RENTAL"] as const;
export type ResourceSourceType = (typeof RESOURCE_SOURCE_TYPES)[number];

export const RESOURCE_APPROVAL_STATES = ["PENDING", "APPROVED", "REJECTED"] as const;
export type ResourceApprovalState = (typeof RESOURCE_APPROVAL_STATES)[number];

// Legal transitions for RENTAL resource review. Anything not listed for a
// given source state is rejected by the service.
export const RESOURCE_APPROVAL_TRANSITIONS: Record<
  ResourceApprovalState,
  ResourceApprovalState[]
> = {
  PENDING: ["APPROVED", "REJECTED"],
  APPROVED: ["REJECTED"],
  REJECTED: ["APPROVED"]
};

export function isLegalResourceApprovalTransition(
  from: ResourceApprovalState,
  to: ResourceApprovalState
): boolean {
  if (from === to) return false;
  return RESOURCE_APPROVAL_TRANSITIONS[from]?.includes(to) ?? false;
}

export const APPROVE_PERMISSION = "approve_resources";
export const APPROVE_RENTAL_PERMISSION = "approve_rental_resources";
export const MANAGE_PERMISSION = "manage_content";
